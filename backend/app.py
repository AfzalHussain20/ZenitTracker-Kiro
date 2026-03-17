from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import random
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'zenit_qa')]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# --- Models ---

class TestStep(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str = ""
    target_type: str = ""
    target_value: str = ""
    input_value: str = ""
    expected_result: str = ""
    order: int = 0

class TestCaseCreate(BaseModel):
    suite_id: str
    name: str
    description: str = ""
    platform: str = "android"
    steps: List[TestStep] = []
    tags: List[str] = []

class TestCaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    platform: Optional[str] = None
    steps: Optional[List[TestStep]] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None

class TestSuiteCreate(BaseModel):
    name: str
    description: str = ""
    tags: List[str] = []

class LocatorStrategyModel(BaseModel):
    type: str
    value: str
    stability_score: float = 0.0

class LocatorCreate(BaseModel):
    element_name: str
    screen_name: str
    platform: str = "android"
    strategies: List[LocatorStrategyModel] = []

class LocatorUpdate(BaseModel):
    element_name: Optional[str] = None
    screen_name: Optional[str] = None
    platform: Optional[str] = None
    strategies: Optional[List[LocatorStrategyModel]] = None

class ExecutionCreate(BaseModel):
    test_case_id: str
    device: str = "Samsung Galaxy S24"
    platform: str = "android"

class ScriptGenRequest(BaseModel):
    test_case_id: str
    language: str = "python"

class DocGenRequest(BaseModel):
    test_case_id: str

class TemplateApplyRequest(BaseModel):
    suite_id: str

# --- Helpers ---
def now_iso():
    return datetime.now(timezone.utc).isoformat()

def new_id():
    return str(uuid.uuid4())

# --- Seed Data ---
async def seed_database():
    existing = await db.templates.count_documents({})
    if existing > 0:
        return

    templates = [
        {
            "id": new_id(), "name": "Login with Mobile OTP", "category": "Authentication",
            "description": "Verify login flow using mobile number and OTP verification on Sun NXT",
            "platform": "both", "tags": ["smoke", "authentication", "p0"],
            "steps": [
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "login_btn", "input_value": "", "expected_result": "Login screen opens", "order": 1},
                {"id": new_id(), "action": "type", "target_type": "accessibilityId", "target_value": "mobile_input", "input_value": "9876543210", "expected_result": "Mobile number entered", "order": 2},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "send_otp_btn", "input_value": "", "expected_result": "OTP sent", "order": 3},
                {"id": new_id(), "action": "wait", "target_type": "", "target_value": "", "input_value": "5", "expected_result": "OTP received", "order": 4},
                {"id": new_id(), "action": "type", "target_type": "accessibilityId", "target_value": "otp_input", "input_value": "123456", "expected_result": "OTP entered", "order": 5},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "verify_btn", "input_value": "", "expected_result": "OTP verified", "order": 6},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "home_screen", "input_value": "", "expected_result": "Home screen displayed", "order": 7},
            ]
        },
        {
            "id": new_id(), "name": "Login with Email", "category": "Authentication",
            "description": "Verify login flow using email and password on Sun NXT",
            "platform": "both", "tags": ["smoke", "authentication"],
            "steps": [
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "login_btn", "input_value": "", "expected_result": "Login screen opens", "order": 1},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "email_tab", "input_value": "", "expected_result": "Email tab selected", "order": 2},
                {"id": new_id(), "action": "type", "target_type": "accessibilityId", "target_value": "email_input", "input_value": "test@sunnxt.com", "expected_result": "Email entered", "order": 3},
                {"id": new_id(), "action": "type", "target_type": "accessibilityId", "target_value": "password_input", "input_value": "********", "expected_result": "Password entered", "order": 4},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "login_submit_btn", "input_value": "", "expected_result": "Login submitted", "order": 5},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "home_screen", "input_value": "", "expected_result": "Home screen displayed", "order": 6},
            ]
        },
        {
            "id": new_id(), "name": "Video Playback", "category": "Playback",
            "description": "Verify video playback controls including play, pause, seek on Sun NXT",
            "platform": "both", "tags": ["regression", "playback", "p0"],
            "steps": [
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "featured_content", "input_value": "", "expected_result": "Content detail page opens", "order": 1},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "content_detail_page", "input_value": "", "expected_result": "Detail page visible", "order": 2},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "play_btn", "input_value": "", "expected_result": "Video starts playing", "order": 3},
                {"id": new_id(), "action": "wait", "target_type": "", "target_value": "", "input_value": "3", "expected_result": "Video buffered", "order": 4},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "video_player", "input_value": "", "expected_result": "Player visible", "order": 5},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "pause_btn", "input_value": "", "expected_result": "Video paused", "order": 6},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "play_btn", "input_value": "", "expected_result": "Video resumed", "order": 7},
                {"id": new_id(), "action": "swipe_right", "target_type": "accessibilityId", "target_value": "seek_bar", "input_value": "50", "expected_result": "Seeked to 50%", "order": 8},
            ]
        },
        {
            "id": new_id(), "name": "Search Content", "category": "Search",
            "description": "Verify search functionality including suggestions and results on Sun NXT",
            "platform": "both", "tags": ["regression", "search"],
            "steps": [
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "search_icon", "input_value": "", "expected_result": "Search screen opens", "order": 1},
                {"id": new_id(), "action": "type", "target_type": "accessibilityId", "target_value": "search_input", "input_value": "Baahubali", "expected_result": "Search text entered", "order": 2},
                {"id": new_id(), "action": "wait", "target_type": "", "target_value": "", "input_value": "2", "expected_result": "Search results loaded", "order": 3},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "search_results", "input_value": "", "expected_result": "Results displayed", "order": 4},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "search_result_0", "input_value": "", "expected_result": "First result tapped", "order": 5},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "content_detail_page", "input_value": "", "expected_result": "Content detail page", "order": 6},
            ]
        },
        {
            "id": new_id(), "name": "Subscription Flow", "category": "Subscription",
            "description": "Verify subscription purchase flow with plan selection on Sun NXT",
            "platform": "both", "tags": ["regression", "subscription", "p0"],
            "steps": [
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "profile_icon", "input_value": "", "expected_result": "Profile opens", "order": 1},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "subscribe_btn", "input_value": "", "expected_result": "Plans page opens", "order": 2},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "plans_list", "input_value": "", "expected_result": "Plans displayed", "order": 3},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "premium_plan", "input_value": "", "expected_result": "Premium plan selected", "order": 4},
                {"id": new_id(), "action": "assert_text", "target_type": "accessibilityId", "target_value": "plan_price", "input_value": "", "expected_result": "Price displayed correctly", "order": 5},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "confirm_subscribe", "input_value": "", "expected_result": "Payment flow triggered", "order": 6},
            ]
        },
        {
            "id": new_id(), "name": "Download Content", "category": "Downloads",
            "description": "Verify content download and offline playback on Sun NXT",
            "platform": "both", "tags": ["regression", "downloads"],
            "steps": [
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "featured_content", "input_value": "", "expected_result": "Content page opens", "order": 1},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "download_icon", "input_value": "", "expected_result": "Download options shown", "order": 2},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "quality_hd", "input_value": "", "expected_result": "HD quality selected", "order": 3},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "confirm_download", "input_value": "", "expected_result": "Download started", "order": 4},
                {"id": new_id(), "action": "wait", "target_type": "", "target_value": "", "input_value": "10", "expected_result": "Download complete", "order": 5},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "downloads_tab", "input_value": "", "expected_result": "Downloads section opens", "order": 6},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "downloaded_content", "input_value": "", "expected_result": "Content available offline", "order": 7},
            ]
        },
        {
            "id": new_id(), "name": "Language Switch", "category": "Localization",
            "description": "Verify language switching between Tamil, Telugu, Malayalam, Kannada on Sun NXT",
            "platform": "both", "tags": ["regression", "localization"],
            "steps": [
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "profile_icon", "input_value": "", "expected_result": "Profile opens", "order": 1},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "settings_icon", "input_value": "", "expected_result": "Settings opens", "order": 2},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "language_option", "input_value": "", "expected_result": "Language picker opens", "order": 3},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "lang_tamil", "input_value": "", "expected_result": "Tamil selected", "order": 4},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "confirm_language", "input_value": "", "expected_result": "Language updated", "order": 5},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "home_screen", "input_value": "", "expected_result": "Content in Tamil", "order": 6},
            ]
        },
        {
            "id": new_id(), "name": "Home Navigation", "category": "Navigation",
            "description": "Verify home screen navigation including carousels, categories, and tabs on Sun NXT",
            "platform": "both", "tags": ["smoke", "navigation"],
            "steps": [
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "home_screen", "input_value": "", "expected_result": "Home screen loaded", "order": 1},
                {"id": new_id(), "action": "swipe_left", "target_type": "accessibilityId", "target_value": "featured_carousel", "input_value": "", "expected_result": "Carousel scrolled", "order": 2},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "movies_tab", "input_value": "", "expected_result": "Movies section opens", "order": 3},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "movies_grid", "input_value": "", "expected_result": "Movies displayed", "order": 4},
                {"id": new_id(), "action": "tap", "target_type": "accessibilityId", "target_value": "tv_shows_tab", "input_value": "", "expected_result": "TV Shows section", "order": 5},
                {"id": new_id(), "action": "scroll", "target_type": "accessibilityId", "target_value": "content_list", "input_value": "down", "expected_result": "Content scrolled", "order": 6},
                {"id": new_id(), "action": "assert_visible", "target_type": "accessibilityId", "target_value": "continue_watching", "input_value": "", "expected_result": "Continue Watching visible", "order": 7},
            ]
        },
    ]
    await db.templates.insert_many(templates)

    # Seed locators
    locators = [
        {"id": new_id(), "element_name": "Login Button", "screen_name": "Splash Screen", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "login_btn", "stability_score": 95}, {"type": "resourceId", "value": "com.sunnxt:id/btn_login", "stability_score": 90}, {"type": "xpath", "value": "//android.widget.Button[@text='Login']", "stability_score": 60}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Mobile Input", "screen_name": "Login Screen", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "mobile_input", "stability_score": 92}, {"type": "resourceId", "value": "com.sunnxt:id/et_mobile", "stability_score": 88}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "OTP Input", "screen_name": "Login Screen", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "otp_input", "stability_score": 90}, {"type": "resourceId", "value": "com.sunnxt:id/et_otp", "stability_score": 85}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Play Button", "screen_name": "Content Detail", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "play_btn", "stability_score": 97}, {"type": "resourceId", "value": "com.sunnxt:id/btn_play", "stability_score": 93}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Pause Button", "screen_name": "Player", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "pause_btn", "stability_score": 95}, {"type": "resourceId", "value": "com.sunnxt:id/btn_pause", "stability_score": 90}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Search Icon", "screen_name": "Home", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "search_icon", "stability_score": 98}, {"type": "resourceId", "value": "com.sunnxt:id/ic_search", "stability_score": 94}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Search Input", "screen_name": "Search", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "search_input", "stability_score": 93}, {"type": "resourceId", "value": "com.sunnxt:id/et_search", "stability_score": 89}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Featured Carousel", "screen_name": "Home", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "featured_carousel", "stability_score": 85}, {"type": "resourceId", "value": "com.sunnxt:id/carousel_featured", "stability_score": 80}, {"type": "xpath", "value": "//androidx.viewpager2.widget.ViewPager2[@resource-id='carousel']", "stability_score": 50}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Download Icon", "screen_name": "Content Detail", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "download_icon", "stability_score": 91}, {"type": "resourceId", "value": "com.sunnxt:id/ic_download", "stability_score": 87}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Settings Icon", "screen_name": "Profile", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "settings_icon", "stability_score": 96}, {"type": "resourceId", "value": "com.sunnxt:id/ic_settings", "stability_score": 92}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Subscribe Button", "screen_name": "Profile", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "subscribe_btn", "stability_score": 94}, {"type": "resourceId", "value": "com.sunnxt:id/btn_subscribe", "stability_score": 90}], "created_at": now_iso()},
        {"id": new_id(), "element_name": "Video Player", "screen_name": "Player", "platform": "android",
         "strategies": [{"type": "accessibilityId", "value": "video_player", "stability_score": 88}, {"type": "resourceId", "value": "com.sunnxt:id/player_view", "stability_score": 84}], "created_at": now_iso()},
    ]
    await db.locators.insert_many(locators)

    # Seed test suites
    suite1_id = new_id()
    suite2_id = new_id()
    suites = [
        {"id": suite1_id, "name": "Sun NXT Authentication", "description": "Authentication test suite covering OTP and email login flows", "tags": ["smoke", "authentication"], "test_count": 2, "pass_rate": 100.0, "created_at": now_iso(), "updated_at": now_iso()},
        {"id": suite2_id, "name": "Sun NXT Playback", "description": "Video playback validation suite for player controls and streaming", "tags": ["regression", "playback"], "test_count": 1, "pass_rate": 85.0, "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.test_suites.insert_many(suites)

    # Seed test cases
    cases = [
        {"id": new_id(), "suite_id": suite1_id, "name": "Login with OTP - Happy Path", "description": "Verify successful login using mobile OTP", "platform": "android", "steps": templates[0]["steps"][:5], "status": "passed", "tags": ["smoke", "p0"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "suite_id": suite1_id, "name": "Login with Email - Happy Path", "description": "Verify successful login using email credentials", "platform": "android", "steps": templates[1]["steps"][:4], "status": "passed", "tags": ["smoke"], "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "suite_id": suite2_id, "name": "Video Playback Controls", "description": "Verify play, pause, and seek controls", "platform": "android", "steps": templates[2]["steps"], "status": "draft", "tags": ["regression", "p0"], "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.test_cases.insert_many(cases)

    # Seed sample executions
    executions = []
    for i in range(8):
        status = random.choice(["passed", "passed", "passed", "failed"])
        ts = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 14))
        executions.append({
            "id": new_id(), "test_case_id": cases[i % 3]["id"],
            "test_case_name": cases[i % 3]["name"], "status": status,
            "device": random.choice(["Samsung Galaxy S24", "Pixel 8 Pro", "iPhone 15", "OnePlus 12"]),
            "platform": random.choice(["android", "ios"]),
            "logs": [{"timestamp": ts.isoformat(), "level": "info", "message": "Execution completed", "step_id": ""}],
            "started_at": ts.isoformat(), "completed_at": (ts + timedelta(minutes=random.randint(1, 5))).isoformat(),
            "duration": round(random.uniform(30, 300), 1),
            "steps_passed": random.randint(3, 7), "steps_failed": 1 if status == "failed" else 0,
            "total_steps": random.randint(5, 8)
        })
    await db.executions.insert_many(executions)
    logging.info("Database seeded with Sun NXT data")

# --- Dashboard ---
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    total_suites = await db.test_suites.count_documents({})
    total_cases = await db.test_cases.count_documents({})
    total_executions = await db.executions.count_documents({})
    passed_execs = await db.executions.count_documents({"status": "passed"})
    pass_rate = round((passed_execs / total_executions * 100), 1) if total_executions > 0 else 0
    recent = await db.executions.find({}, {"_id": 0}).sort("started_at", -1).to_list(10)
    total_locators = await db.locators.count_documents({})
    total_templates = await db.templates.count_documents({})
    return {
        "total_suites": total_suites, "total_cases": total_cases,
        "total_executions": total_executions, "pass_rate": pass_rate,
        "total_locators": total_locators, "total_templates": total_templates,
        "recent_executions": recent
    }

# --- Test Suites ---
@api_router.get("/test-suites")
async def get_test_suites():
    suites = await db.test_suites.find({}, {"_id": 0}).to_list(1000)
    for s in suites:
        s["test_count"] = await db.test_cases.count_documents({"suite_id": s["id"]})
        cases = await db.test_cases.find({"suite_id": s["id"]}, {"_id": 0, "status": 1}).to_list(1000)
        passed = sum(1 for c in cases if c.get("status") == "passed")
        s["pass_rate"] = round(passed / len(cases) * 100, 1) if cases else 0
    return suites

@api_router.post("/test-suites")
async def create_test_suite(data: TestSuiteCreate):
    doc = {"id": new_id(), "name": data.name, "description": data.description, "tags": data.tags, "test_count": 0, "pass_rate": 0, "created_at": now_iso(), "updated_at": now_iso()}
    await db.test_suites.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.delete("/test-suites/{suite_id}")
async def delete_test_suite(suite_id: str):
    await db.test_suites.delete_one({"id": suite_id})
    await db.test_cases.delete_many({"suite_id": suite_id})
    return {"status": "deleted"}

# --- Test Cases ---
@api_router.get("/test-cases")
async def get_test_cases(suite_id: Optional[str] = None):
    query = {"suite_id": suite_id} if suite_id else {}
    cases = await db.test_cases.find(query, {"_id": 0}).to_list(1000)
    return cases

@api_router.get("/test-cases/{case_id}")
async def get_test_case(case_id: str):
    case = await db.test_cases.find_one({"id": case_id}, {"_id": 0})
    if not case:
        raise HTTPException(404, "Test case not found")
    return case

@api_router.post("/test-cases")
async def create_test_case(data: TestCaseCreate):
    steps = [s.model_dump() for s in data.steps]
    doc = {"id": new_id(), "suite_id": data.suite_id, "name": data.name, "description": data.description, "platform": data.platform, "steps": steps, "status": "draft", "tags": data.tags, "created_at": now_iso(), "updated_at": now_iso()}
    await db.test_cases.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/test-cases/{case_id}")
async def update_test_case(case_id: str, data: TestCaseUpdate):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "steps" in update:
        update["steps"] = [s.model_dump() if hasattr(s, 'model_dump') else s for s in update["steps"]]
    update["updated_at"] = now_iso()
    await db.test_cases.update_one({"id": case_id}, {"$set": update})
    case = await db.test_cases.find_one({"id": case_id}, {"_id": 0})
    return case

@api_router.delete("/test-cases/{case_id}")
async def delete_test_case(case_id: str):
    await db.test_cases.delete_one({"id": case_id})
    return {"status": "deleted"}

# --- Locators ---
@api_router.get("/locators")
async def get_locators(screen_name: Optional[str] = None):
    query = {"screen_name": screen_name} if screen_name else {}
    return await db.locators.find(query, {"_id": 0}).to_list(1000)

@api_router.post("/locators")
async def create_locator(data: LocatorCreate):
    doc = {"id": new_id(), "element_name": data.element_name, "screen_name": data.screen_name, "platform": data.platform, "strategies": [s.model_dump() for s in data.strategies], "created_at": now_iso()}
    await db.locators.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/locators/{loc_id}")
async def update_locator(loc_id: str, data: LocatorUpdate):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if "strategies" in update:
        update["strategies"] = [s.model_dump() if hasattr(s, 'model_dump') else s for s in update["strategies"]]
    await db.locators.update_one({"id": loc_id}, {"$set": update})
    loc = await db.locators.find_one({"id": loc_id}, {"_id": 0})
    return loc

@api_router.delete("/locators/{loc_id}")
async def delete_locator(loc_id: str):
    await db.locators.delete_one({"id": loc_id})
    return {"status": "deleted"}

# --- Executions ---
@api_router.get("/executions")
async def get_executions():
    return await db.executions.find({}, {"_id": 0}).sort("started_at", -1).to_list(100)

@api_router.get("/executions/{exec_id}")
async def get_execution(exec_id: str):
    ex = await db.executions.find_one({"id": exec_id}, {"_id": 0})
    if not ex:
        raise HTTPException(404, "Execution not found")
    return ex

@api_router.post("/executions/run")
async def run_execution(data: ExecutionCreate):
    case = await db.test_cases.find_one({"id": data.test_case_id}, {"_id": 0})
    if not case:
        raise HTTPException(404, "Test case not found")
    exec_id = new_id()
    started = datetime.now(timezone.utc)
    logs = []
    steps_passed = 0
    steps_failed = 0
    logs.append({"timestamp": started.isoformat(), "level": "info", "message": f"Starting execution on {data.device} ({data.platform})", "step_id": ""})
    logs.append({"timestamp": (started + timedelta(seconds=1)).isoformat(), "level": "info", "message": f"Initializing Appium session for Sun NXT...", "step_id": ""})
    for step in case.get("steps", []):
        step_time = started + timedelta(seconds=2 + step.get("order", 0) * 2)
        action_desc = f"{step['action']} on {step.get('target_value', 'N/A')}"
        if step.get("input_value"):
            action_desc += f" with value '{step['input_value']}'"
        logs.append({"timestamp": step_time.isoformat(), "level": "info", "message": f"Step {step['order']}: Executing {action_desc}", "step_id": step.get("id", "")})
        success = random.random() > 0.12
        if success:
            steps_passed += 1
            logs.append({"timestamp": (step_time + timedelta(seconds=1)).isoformat(), "level": "success", "message": f"Step {step['order']}: PASSED - {step.get('expected_result', 'OK')}", "step_id": step.get("id", "")})
        else:
            steps_failed += 1
            logs.append({"timestamp": (step_time + timedelta(seconds=1)).isoformat(), "level": "error", "message": f"Step {step['order']}: FAILED - Element not found: {step.get('target_value', '')}", "step_id": step.get("id", "")})
    completed = started + timedelta(seconds=len(case.get("steps", [])) * 3 + 5)
    status = "passed" if steps_failed == 0 else "failed"
    logs.append({"timestamp": completed.isoformat(), "level": "info", "message": f"Execution completed: {status.upper()} ({steps_passed}/{steps_passed + steps_failed} steps passed)", "step_id": ""})
    doc = {
        "id": exec_id, "test_case_id": data.test_case_id, "test_case_name": case["name"],
        "status": status, "device": data.device, "platform": data.platform, "logs": logs,
        "started_at": started.isoformat(), "completed_at": completed.isoformat(),
        "duration": round((completed - started).total_seconds(), 1),
        "steps_passed": steps_passed, "steps_failed": steps_failed,
        "total_steps": len(case.get("steps", []))
    }
    await db.executions.insert_one(doc)
    doc.pop("_id", None)
    # Update test case status
    await db.test_cases.update_one({"id": data.test_case_id}, {"$set": {"status": status}})
    return doc

# --- Templates ---
@api_router.get("/templates")
async def get_templates():
    return await db.templates.find({}, {"_id": 0}).to_list(100)

@api_router.post("/templates/{template_id}/apply")
async def apply_template(template_id: str, data: TemplateApplyRequest):
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(404, "Template not found")
    new_steps = []
    for s in template.get("steps", []):
        new_steps.append({**s, "id": new_id()})
    doc = {
        "id": new_id(), "suite_id": data.suite_id, "name": template["name"],
        "description": template["description"], "platform": template["platform"],
        "steps": new_steps, "status": "draft", "tags": template.get("tags", []),
        "created_at": now_iso(), "updated_at": now_iso()
    }
    await db.test_cases.insert_one(doc)
    doc.pop("_id", None)
    return doc

# --- Script Generation ---
def _locator_python(target_type, target_value):
    mapping = {"accessibilityId": "AppiumBy.ACCESSIBILITY_ID", "resourceId": "AppiumBy.ID", "xpath": "AppiumBy.XPATH", "className": "AppiumBy.CLASS_NAME", "text": "AppiumBy.ANDROID_UIAUTOMATOR"}
    by = mapping.get(target_type, "AppiumBy.ACCESSIBILITY_ID")
    return f'{by}, "{target_value}"'

def _locator_java(target_type, target_value):
    mapping = {"accessibilityId": "AppiumBy.accessibilityId", "resourceId": "AppiumBy.id", "xpath": "AppiumBy.xpath", "className": "AppiumBy.className"}
    by = mapping.get(target_type, "AppiumBy.accessibilityId")
    return f'{by}("{target_value}")'

def _locator_js(target_type, target_value):
    mapping = {"accessibilityId": "~", "resourceId": "id=", "xpath": "", "className": "."}
    prefix = mapping.get(target_type, "~")
    if target_type == "xpath":
        return f"$('{target_value}')"
    return f"$('{" " if target_type == "xpath" else prefix}{target_value}')"

def generate_python(case):
    lines = [
        '"""', f'Test Case: {case["name"]}', f'Platform: {case["platform"]}',
        f'Generated: {now_iso()}', f'Description: {case.get("description", "")}', '"""',
        '', 'from appium import webdriver', 'from appium.webdriver.common.appiumby import AppiumBy',
        'from selenium.webdriver.support.ui import WebDriverWait',
        'from selenium.webdriver.support import expected_conditions as EC', 'import time', '',
        '', 'class SunNXTTest:', '    def setup(self):',
        '        desired_caps = {', "            'platformName': 'Android',",
        "            'appPackage': 'com.sunnxt.app',",
        "            'appActivity': 'com.sunnxt.app.MainActivity',",
        "            'automationName': 'UiAutomator2',",
        "            'deviceName': 'Android Device',", '        }',
        "        self.driver = webdriver.Remote('http://localhost:4723/wd/hub', desired_caps)",
        '        self.wait = WebDriverWait(self.driver, 10)', '',
        f'    def test_{case["name"].lower().replace(" ", "_").replace("-", "_")}(self):',
    ]
    for step in case.get("steps", []):
        a = step["action"]
        tv = step.get("target_value", "")
        tt = step.get("target_type", "")
        iv = step.get("input_value", "")
        er = step.get("expected_result", "")
        lines.append(f'        # Step {step["order"]}: {er}')
        if a == "tap":
            lines.append(f'        element = self.wait.until(EC.element_to_be_clickable(({_locator_python(tt, tv)})))')
            lines.append('        element.click()')
        elif a == "type":
            lines.append(f'        element = self.wait.until(EC.presence_of_element_located(({_locator_python(tt, tv)})))')
            lines.append('        element.clear()')
            lines.append(f'        element.send_keys("{iv}")')
        elif a == "wait":
            lines.append(f'        time.sleep({iv or 2})')
        elif a in ("assert_visible", "assert_text"):
            lines.append(f'        element = self.wait.until(EC.visibility_of_element_located(({_locator_python(tt, tv)})))')
            lines.append('        assert element.is_displayed()')
        elif a in ("swipe_left", "swipe_right", "swipe_up", "swipe_down"):
            lines.append(f'        # Swipe {a.split("_")[1]}')
            lines.append('        size = self.driver.get_window_size()')
            if a == "swipe_left":
                lines.append("        self.driver.swipe(size['width']*0.8, size['height']*0.5, size['width']*0.2, size['height']*0.5, 800)")
            elif a == "swipe_right":
                lines.append("        self.driver.swipe(size['width']*0.2, size['height']*0.5, size['width']*0.8, size['height']*0.5, 800)")
            else:
                lines.append("        self.driver.swipe(size['width']*0.5, size['height']*0.8, size['width']*0.5, size['height']*0.2, 800)")
        elif a == "scroll":
            lines.append("        self.driver.find_element(AppiumBy.ANDROID_UIAUTOMATOR,")
            lines.append(f'            \'new UiScrollable(new UiSelector().scrollable(true)).scrollForward()\')')
        elif a == "long_press":
            lines.append(f'        element = self.wait.until(EC.presence_of_element_located(({_locator_python(tt, tv)})))')
            lines.append('        from appium.webdriver.common.touch_action import TouchAction')
            lines.append('        TouchAction(self.driver).long_press(element).release().perform()')
        elif a == "back":
            lines.append('        self.driver.back()')
        lines.append('')
    lines.extend(['    def teardown(self):', '        self.driver.quit()'])
    return '\n'.join(lines)

def generate_java(case):
    class_name = ''.join(w.capitalize() for w in case["name"].replace("-", " ").split())
    lines = [
        f'// Test Case: {case["name"]}', f'// Platform: {case["platform"]}',
        f'// Generated: {now_iso()}', '',
        'import io.appium.java_client.android.AndroidDriver;',
        'import io.appium.java_client.AppiumBy;',
        'import org.openqa.selenium.remote.DesiredCapabilities;',
        'import org.openqa.selenium.support.ui.WebDriverWait;',
        'import org.openqa.selenium.support.ui.ExpectedConditions;',
        'import org.openqa.selenium.WebElement;',
        'import java.net.URL;', 'import java.time.Duration;',
        'import org.testng.annotations.*;', '',
        f'public class {class_name}Test {{',
        '    AndroidDriver driver;', '    WebDriverWait wait;', '',
        '    @BeforeMethod', '    public void setup() throws Exception {',
        '        DesiredCapabilities caps = new DesiredCapabilities();',
        '        caps.setCapability("platformName", "Android");',
        '        caps.setCapability("appPackage", "com.sunnxt.app");',
        '        caps.setCapability("appActivity", "com.sunnxt.app.MainActivity");',
        '        caps.setCapability("automationName", "UiAutomator2");',
        '        driver = new AndroidDriver(new URL("http://localhost:4723/wd/hub"), caps);',
        '        wait = new WebDriverWait(driver, Duration.ofSeconds(10));',
        '    }', '',
        '    @Test',
        f'    public void test{class_name}() {{',
    ]
    for step in case.get("steps", []):
        a = step["action"]
        tv = step.get("target_value", "")
        tt = step.get("target_type", "")
        iv = step.get("input_value", "")
        er = step.get("expected_result", "")
        lines.append(f'        // Step {step["order"]}: {er}')
        if a == "tap":
            lines.append(f'        wait.until(ExpectedConditions.elementToBeClickable({_locator_java(tt, tv)})).click();')
        elif a == "type":
            lines.append(f'        WebElement el = wait.until(ExpectedConditions.presenceOfElementLocated({_locator_java(tt, tv)}));')
            lines.append('        el.clear();')
            lines.append(f'        el.sendKeys("{iv}");')
        elif a == "wait":
            lines.append(f'        Thread.sleep({int(iv or 2) * 1000});')
        elif a in ("assert_visible", "assert_text"):
            lines.append(f'        assert wait.until(ExpectedConditions.visibilityOfElementLocated({_locator_java(tt, tv)})).isDisplayed();')
        elif a.startswith("swipe"):
            lines.append(f'        // Perform {a} gesture')
        lines.append('')
    lines.extend(['    }', '', '    @AfterMethod', '    public void teardown() {',
                  '        if (driver != null) driver.quit();', '    }', '}'])
    return '\n'.join(lines)

def generate_javascript(case):
    lines = [
        f'// Test Case: {case["name"]}', f'// Platform: {case["platform"]}',
        f'// Generated: {now_iso()}', '',
        "const { remote } = require('webdriverio');", '',
        f"describe('{case['name']}', () => {{",
        '    let driver;', '',
        '    before(async () => {', '        driver = await remote({',
        "            hostname: 'localhost',", '            port: 4723,',
        '            capabilities: {', "                platformName: 'Android',",
        "                'appium:appPackage': 'com.sunnxt.app',",
        "                'appium:appActivity': 'com.sunnxt.app.MainActivity',",
        "                'appium:automationName': 'UiAutomator2',",
        '            }', '        });', '    });', '',
        f"    it('should {case['name'].lower()}', async () => {{",
    ]
    for step in case.get("steps", []):
        a = step["action"]
        tv = step.get("target_value", "")
        tt = step.get("target_type", "")
        iv = step.get("input_value", "")
        er = step.get("expected_result", "")
        lines.append(f'        // Step {step["order"]}: {er}')
        loc = _locator_js(tt, tv)
        if a == "tap":
            lines.append(f'        const el{step["order"]} = await {loc};')
            lines.append(f'        await el{step["order"]}.click();')
        elif a == "type":
            lines.append(f'        const el{step["order"]} = await {loc};')
            lines.append(f'        await el{step["order"]}.clearValue();')
            lines.append(f'        await el{step["order"]}.setValue(\'{iv}\');')
        elif a == "wait":
            lines.append(f'        await driver.pause({int(iv or 2) * 1000});')
        elif a in ("assert_visible", "assert_text"):
            lines.append(f'        const el{step["order"]} = await {loc};')
            lines.append(f'        expect(await el{step["order"]}.isDisplayed()).toBe(true);')
        lines.append('')
    lines.extend(['    });', '', '    after(async () => {',
                  '        if (driver) await driver.deleteSession();', '    });', '});'])
    return '\n'.join(lines)

@api_router.post("/scripts/generate")
async def generate_script(data: ScriptGenRequest):
    case = await db.test_cases.find_one({"id": data.test_case_id}, {"_id": 0})
    if not case:
        raise HTTPException(404, "Test case not found")
    generators = {"python": generate_python, "java": generate_java, "javascript": generate_javascript}
    gen = generators.get(data.language, generate_python)
    script = gen(case)
    return {"script": script, "language": data.language, "test_case_id": data.test_case_id, "test_case_name": case["name"]}

# --- Documentation Generation ---
@api_router.post("/docs/generate")
async def generate_docs(data: DocGenRequest):
    case = await db.test_cases.find_one({"id": data.test_case_id}, {"_id": 0})
    if not case:
        raise HTTPException(404, "Test case not found")
    lines = [
        f'# Test Case: {case["name"]}', '', '## Overview', '',
        f'| Field | Value |', f'|-------|-------|',
        f'| **Name** | {case["name"]} |',
        f'| **Platform** | {case["platform"].upper()} |',
        f'| **Status** | {case["status"].upper()} |',
        f'| **Tags** | {", ".join(case.get("tags", []))} |',
        f'| **Created** | {case.get("created_at", "N/A")} |',
        '', f'## Description', '', case.get("description", "No description provided."),
        '', '## Test Steps', '', '| # | Action | Target | Input | Expected Result |',
        '|---|--------|--------|-------|-----------------|',
    ]
    for step in case.get("steps", []):
        target = f'{step.get("target_type", "")}={step.get("target_value", "")}' if step.get("target_value") else "N/A"
        lines.append(f'| {step["order"]} | {step["action"]} | {target} | {step.get("input_value", "-")} | {step.get("expected_result", "-")} |')
    lines.extend([
        '', '## Preconditions', '', '- Sun NXT app installed on test device',
        '- Appium server running', '- Device connected and authorized',
        '', '## Environment', '', '- App: Sun NXT', '- Framework: Appium + UiAutomator2',
        f'- Platform: {case["platform"].upper()}', '',
        '---', f'*Auto-generated documentation*'
    ])
    doc_content = '\n'.join(lines)
    return {"content": doc_content, "test_case_id": data.test_case_id, "test_case_name": case["name"], "format": "markdown"}

# --- App Setup ---
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    await seed_database()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
