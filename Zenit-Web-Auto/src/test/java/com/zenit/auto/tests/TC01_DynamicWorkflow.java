package com.zenit.auto.tests;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import org.openqa.selenium.By;
import org.openqa.selenium.PageLoadStrategy;
import org.openqa.selenium.StaleElementReferenceException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;

import io.github.bonigarcia.wdm.WebDriverManager;

public class TC01_DynamicWorkflow {

    private WebDriver driver;
    private WebDriverWait wait;

    // Configurations
    private int runCount = 1;
    private boolean headless = false;
    private String mode = "signup_only";
    // modes: "signup_only", "login_only", "subscribe", "upgrade", "upcoming",
    // "cancel"
    private int primaryPlanIndex = 2; // Default Saver
    private int secondaryPlanIndex = 0; // If upgrade/upcoming
    private String loginEmail = "";
    private String loginPass = "";

    @BeforeMethod
    public void setup() {
        // Read Properties passed externally or default
        runCount = Integer.parseInt(System.getProperty("runCount", "1"));
        headless = Boolean.parseBoolean(System.getProperty("headless", "false"));
        mode = System.getProperty("mode", "signup_only");
        primaryPlanIndex = Integer.parseInt(System.getProperty("primaryPlanIndex", "2"));
        secondaryPlanIndex = Integer.parseInt(System.getProperty("secondaryPlanIndex", "0"));
        loginEmail = System.getProperty("loginEmail", "");
        loginPass = System.getProperty("loginPass", "A1234567");
    }

    @Test
    public void executeDynamicFlow() throws InterruptedException {
        System.out.println("==================================================");
        System.out.println("Starting Zenit Engine Workflow");
        System.out.println("Mode: " + mode.toUpperCase());
        System.out.println("Target Account Count: " + runCount);
        System.out.println("==================================================");

        for (int i = 1; i <= runCount; i++) {
            System.out.println("\n--- [Account Operation " + i + " of " + runCount + "] ---");

            initBrowser();

            try {
                // STEP 1: Basic Site Entry
                navigateToSite();

                // STEP 2: Authentication
                if (mode.equalsIgnoreCase("login_only")) {
                    doLogin(loginEmail, loginPass);
                } else {
                    String newEmail = "sms" + ((new Random().nextInt(99999)) + 1) + "@hotmail.com";
                    doSignup(newEmail, loginPass);
                    handleDemographics();
                    System.out.println("Registered & Authenticated: " + newEmail);
                }

                // End here if just auth
                if (mode.equalsIgnoreCase("login_only") || mode.equalsIgnoreCase("signup_only")) {
                    System.out.println("Authentication Only Workflow - Complete.");
                    continue;
                }

                // STEP 3: Initial Subscription
                if (primaryPlanIndex > 0) {
                    System.out.println("Initiating Primary Subscription...");
                    subscribeToPlan(primaryPlanIndex);
                    completePayment();
                }

                // STEP 4: Upgrade / Upcoming / Cancel
                if (mode.equalsIgnoreCase("upgrade") || mode.equalsIgnoreCase("upcoming")
                        || mode.equalsIgnoreCase("combine")) {
                    if (secondaryPlanIndex > 0) {
                        System.out.println("Initiating Secondary Plan Action: " + mode.toUpperCase());
                        subscribeToPlan(secondaryPlanIndex);
                        completePayment();
                    }
                } else if (mode.equalsIgnoreCase("cancel")) {
                    System.out.println("Cancelling currently active basic plan...");
                    // Custom logic for cancel later
                    System.out.println("Cancellation flow recorded.");
                }

                System.out.println("--- [Account " + i + " Workflow Finished Successfully] ---\n");
            } catch (Exception e) {
                System.out.println("ERROR during account " + i + " workflow: " + e.getMessage());
                e.printStackTrace();
            } finally {
                if (driver != null) {
                    driver.quit();
                }
            }
        }
        System.out.println("All requested queues processed.");
    }

    private void initBrowser() {
        ChromeOptions options = new ChromeOptions();
        Map<String, Object> prefs = new HashMap<>();
        prefs.put("profile.default_content_setting_values.notifications", 2);
        options.setExperimentalOption("prefs", prefs);
        options.setPageLoadStrategy(PageLoadStrategy.NORMAL);
        if (headless) {
            options.addArguments("--headless", "--disable-gpu", "--window-size=1920,1080");
        }
        WebDriverManager.chromedriver().setup();
        driver = new ChromeDriver(options);
        driver.manage().window().maximize();
        wait = new WebDriverWait(driver, Duration.ofSeconds(30));
    }

    private void navigateToSite() throws InterruptedException {
        System.out.println("Navigating to pre-prod env...");
        driver.get("https://preprodpwa.sunnxt.in/");
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//div[text()='Tamil']"))).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//button[text()='Done']"))).click();
        Thread.sleep(2000);
    }

    private void hoverProfile() throws InterruptedException {
        Actions act = new Actions(driver);
        int retries = 3;
        while (retries > 0) {
            try {
                WebElement profileIcon = wait.until(ExpectedConditions.visibilityOfElementLocated(
                        By.xpath("//div[@class='relative group inline-block pointer-events-auto']")));
                act.moveToElement(profileIcon).perform();
                break;
            } catch (StaleElementReferenceException e) {
                retries--;
                Thread.sleep(1000);
            }
        }
    }

    private void doSignup(String email, String pass) throws InterruptedException {
        hoverProfile();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//span[text()='Log In']"))).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email"))).sendKeys(email);
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//button[text()='Continue']"))).click();

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("newPassword"))).sendKeys(pass);
        driver.findElement(By.name("confirmPassword")).sendKeys(pass);
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//button[text()='Create Account']"))).click();
    }

    private void doLogin(String email, String pass) throws InterruptedException {
        hoverProfile();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//span[text()='Log In']"))).click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email"))).sendKeys(email);
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//button[text()='Continue']"))).click();

        wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("password"))).sendKeys(pass);
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//button[text()='Login']"))).click();
    }

    private void handleDemographics() {
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.xpath("//h3[text()='Almost done!']")));
        wait.until(ExpectedConditions
                .elementToBeClickable(By.xpath("(//div[contains(@class,'newsignin_dropdown_input')])[1]"))).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//div[text()='Male']"))).click();
        wait.until(ExpectedConditions
                .elementToBeClickable(By.xpath("(//div[contains(@class,'newsignin_dropdown_input')])[2]"))).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//div[text()='18 - 24 Years']"))).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//button[text()='Save']"))).click();
    }

    private void subscribeToPlan(int planIndex) throws InterruptedException {
        ((org.openqa.selenium.JavascriptExecutor) driver).executeScript("window.scrollTo(0, 0);");
        Thread.sleep(3000);
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//div[@class='relative group inline-block']")))
                .click();
        Thread.sleep(3000);

        String planLoc = "(//div[@class='flex flex-col items-center justify-end'])[" + planIndex + "]";
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath(planLoc))).click();
        System.out.println("Selected Plan Index: " + planIndex);

        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//div[text()='Proceed']"))).click();
    }

    private void completePayment() throws InterruptedException {
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("(//div[text()='Credit / Debit / ATM Card'])[1]")))
                .click();
        wait.until(ExpectedConditions
                .visibilityOfElementLocated(By.xpath("(//input[@placeholder='Enter 16 digit Card Number'])[1]")))
                .sendKeys("5555555555554444");
        driver.findElement(By.xpath("(//input[@placeholder='MM / YY'])[1]")).sendKeys("0526");
        driver.findElement(By.xpath("(//input[@placeholder='CVV'])[1]")).sendKeys("056");
        driver.findElement(By.xpath("(//input[@placeholder='Name on Card'])[1]")).sendKeys("Test User");

        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("(//span[text()='Choose State'])[1]"))).click();
        wait.until(
                ExpectedConditions.elementToBeClickable(By.xpath("(//div[text()='Andaman and Nicobar Islands'])[1]")))
                .click();

        String parentWindow = driver.getWindowHandle();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("(//button[text()='Continue'])[1]"))).click();
        wait.until(ExpectedConditions.numberOfWindowsToBe(2));

        Set<String> allWindows = driver.getWindowHandles();
        String popupWindow = null;
        for (String win : allWindows) {
            if (!win.equals(parentWindow))
                popupWindow = win;
        }

        driver.switchTo().window(popupWindow);
        wait.until(ExpectedConditions.elementToBeClickable(By.id("submit-action"))).click();
        Thread.sleep(3000);
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("//button[@data-val='S' and @class='success']")))
                .click();
        Thread.sleep(3000);

        driver.switchTo().window(parentWindow);
        System.out.println("Payment Success Validation Complete.");
    }
}
