export type Framework = 'selenium' | 'playwright' | 'cypress' | 'vibium' | 'appium';

export interface TheoryBlock {
    title: string;
    content: string;
    points: string[];
    syntax?: { code: string; lang: string };
}

export interface Lesson {
    id: string;
    title: string;
    framework: Framework;
    module: string;
    duration: string;
    xp: number;
    difficulty: 'Foundational' | 'Advanced' | 'Architect';
    theory: TheoryBlock[];
    lab: {
        mission: string;
        starter: string;
        solution: string;
        validation: { id: string; label: string; keywords: string[] }[];
    };
}

export const FRAMEWORKS: Record<Framework, {
    name: string; tagline: string; accent: string; lessons: number; hours: string;
}> = {
    selenium: { name: 'Selenium Java', tagline: 'W3C-compliant enterprise web automation', accent: '#3B82F6', lessons: 6, hours: '9h 30m' },
    playwright: { name: 'Playwright', tagline: 'Modern cross-browser test orchestration', accent: '#EF4444', lessons: 5, hours: '7h 15m' },
    cypress: { name: 'Cypress', tagline: 'Real-time developer-first testing', accent: '#10B981', lessons: 4, hours: '6h 45m' },
    vibium: { name: 'Vibium AI', tagline: 'Intent-driven agentic automation', accent: '#8B5CF6', lessons: 3, hours: '5h 00m' },
    appium: { name: 'Appium', tagline: 'Cross-platform mobile automation', accent: '#F59E0B', lessons: 4, hours: '7h 50m' },
};

export const COURSE_DATA: Lesson[] = [
    // ─── SELENIUM ──────────────────────────────────────────────────────────────
    {
        id: 'sel-00',
        title: 'Environment Setup & Hello World',
        framework: 'selenium',
        module: 'Module 0 — Getting Started',
        duration: '45 min',
        xp: 200,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'JDK & IDE Setup',
                content: 'To start with Selenium Java, you need the Java Development Kit (JDK) and an IDE like IntelliJ IDEA or Eclipse. Ensure your JAVA_HOME environment variable is set. Once installed, we use a build tool like Maven to manage dependencies.',
                points: [
                    'Install JDK 17+ and set the JAVA_HOME environment variable.',
                    'Install IntelliJ IDEA Community Edition.',
                    'Create a new Maven project and add the selenium-java dependency to your pom.xml.',
                    'With Selenium 4.6+, Selenium Manager automatically downloads the required browser drivers, so you don\'t need to download ChromeDriver manually!'
                ],
                syntax: {
                    code: `<!-- Add this to your pom.xml -->
<dependencies>
    <dependency>
        <groupId>org.seleniumhq.selenium</groupId>
        <artifactId>selenium-java</artifactId>
        <version>4.18.1</version>
    </dependency>
</dependencies>`,
                    lang: 'xml',
                },
            },
            {
                title: 'Your First Valid Script (Hello World)',
                content: 'A "Hello World" in Selenium involves opening a browser, navigating to a URL, checking the title, and closing the browser. Try this exactly as shown below.',
                points: [
                    'Initialize a ChromeDriver instance.',
                    'Use driver.get() to navigate.',
                    'Use driver.getTitle() to retrieve the title.',
                    'Always use driver.quit() to completely close the browser process.'
                ],
                syntax: {
                    code: `import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

public class HelloWorld {
    public static void main(String[] args) {
        // Selenium Manager handles chromedriver.exe behind the scenes!
        WebDriver driver = new ChromeDriver();
        try {
            driver.get("https://example.com");
            System.out.println("Page Title is: " + driver.getTitle());
        } finally {
            driver.quit(); 
        }
    }
}`,
                    lang: 'Java',
                },
            }
        ],
        lab: {
            mission: 'Initialize ChromeDriver, navigate to "https://example.com", assert the title is "Example Domain", and quit the driver.',
            starter: `import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

public class Lab00 {
    public static void main(String[] args) {
        // TODO: Initialize ChromeDriver 
        
        // TODO: Navigate to https://example.com
        
        // TODO: Asssert the title equals "Example Domain"
        
        // TODO: Quit the driver
    }
}`,
            solution: `import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;

public class Lab00 {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        driver.get("https://example.com");
        
        assert driver.getTitle().equals("Example Domain");
        
        driver.quit();
    }
}`,
            validation: [
                { id: 'v1', label: 'ChromeDriver initialized', keywords: ['new ChromeDriver'] },
                { id: 'v2', label: 'Navigation', keywords: ['driver.get', 'example.com'] },
                { id: 'v3', label: 'Assertion', keywords: ['getTitle', 'Example Domain'] },
                { id: 'v4', label: 'Driver quit', keywords: ['driver.quit'] }
            ],
        }
    },
    {
        id: 'sel-01',
        title: 'WebDriver Architecture & W3C Protocol',
        framework: 'selenium',
        module: 'Module 1 — Foundations',
        duration: '50 min',
        xp: 250,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'The W3C WebDriver Specification',
                content: 'Selenium 4 fully adopts the W3C WebDriver specification, replacing the legacy JSON Wire Protocol. The W3C standard defines a platform- and language-neutral wire protocol as a way for out-of-process programs to remotely instruct the behavior of web browsers. This architectural shift means every major browser vendor now ships a compliant driver natively, eliminating the need for third-party adapters.',
                points: [
                    'Direct HTTP/1.1 communication between client library and browser driver',
                    'Standardized error codes (e.g., NoSuchElement, StaleElementReference) across all vendors',
                    'Native support for Chrome DevTools Protocol (CDP) via BiDi',
                    'Relative locators introduced as a W3C extension for spatial element discovery',
                ],
                syntax: {
                    code: `// Selenium 4 — Minimal W3C-compliant driver bootstrap
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import java.time.Duration;

public class DriverFactory {
    public static WebDriver create() {
        ChromeOptions opts = new ChromeOptions();
        opts.addArguments("--disable-dev-shm-usage", "--no-sandbox");

        WebDriver driver = new ChromeDriver(opts);
        driver.manage().timeouts()
              .implicitlyWait(Duration.ofSeconds(10))
              .pageLoadTimeout(Duration.ofSeconds(30));
        driver.manage().window().maximize();
        return driver;
    }
}`,
                    lang: 'Java',
                },
            },
            {
                title: 'Driver Lifecycle & Resource Management',
                content: 'Improper driver lifecycle management is the leading cause of flaky tests and resource leaks in enterprise suites. Every WebDriver instance holds a browser process, a driver process, and a network socket. Failing to call driver.quit() leaves zombie processes that accumulate across CI runs.',
                points: [
                    'driver.close() — closes the current window only; driver process remains alive',
                    'driver.quit() — terminates browser + driver process and releases all resources',
                    'Use try-finally or JUnit @AfterEach to guarantee cleanup even on test failure',
                    'ThreadLocal<WebDriver> pattern enables safe parallel execution',
                ],
                syntax: {
                    code: `// Thread-safe driver management for parallel suites
public class DriverManager {
    private static final ThreadLocal<WebDriver> TL = new ThreadLocal<>();

    public static WebDriver get() { return TL.get(); }

    public static void init() {
        TL.set(DriverFactory.create());
    }

    public static void quit() {
        if (TL.get() != null) {
            TL.get().quit();
            TL.remove();
        }
    }
}`,
                    lang: 'Java',
                },
            },
        ],
        lab: {
            mission: 'Implement a DriverFactory that creates a headless ChromeDriver with a 30-second page load timeout, navigates to https://the-internet.herokuapp.com (a real public automation practice site), prints the page title, asserts it is not empty, then calls quit(). Run this against the live site to see it work.',
            starter: `import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import java.time.Duration;

public class Lab01 {
    public static void main(String[] args) {
        // TODO: Create ChromeOptions with --headless=new argument

        // TODO: Instantiate ChromeDriver with options

        // TODO: Set pageLoadTimeout to 30 seconds

        // TODO: Navigate to https://the-internet.herokuapp.com

        // TODO: Assert title is not empty (print it)

        // TODO: Quit the driver
    }
}`,
            solution: `import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import java.time.Duration;

public class Lab01 {
    public static void main(String[] args) {
        ChromeOptions opts = new ChromeOptions();
        opts.addArguments("--headless=new");

        WebDriver driver = new ChromeDriver(opts);
        driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(30));
        driver.get("https://the-internet.herokuapp.com");

        String title = driver.getTitle();
        assert !title.isEmpty() : "Title should not be empty";
        System.out.println("Title: " + title); // Expected: "The Internet"

        driver.quit();
    }
}`,
            validation: [
                { id: 'v1', label: 'ChromeOptions configured', keywords: ['new ChromeOptions'] },
                { id: 'v2', label: 'Headless mode enabled', keywords: ['headless'] },
                { id: 'v3', label: 'Page load timeout set', keywords: ['pageLoadTimeout'] },
                { id: 'v4', label: 'Navigation to practice site', keywords: ['driver.get', 'herokuapp'] },
                { id: 'v5', label: 'Driver quit called', keywords: ['driver.quit'] },
            ],
        },
    },
    {
        id: 'sel-02',
        title: 'Element Location Strategies & Resilient Selectors',
        framework: 'selenium',
        module: 'Module 1 — Foundations',
        duration: '60 min',
        xp: 300,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'The Locator Hierarchy',
                content: 'Selector strategy directly determines test maintainability. The industry-standard priority is: ID > data-testid > CSS Selector > XPath. Avoid positional XPath like //div[3]/span[2] — it breaks on any DOM reorder. Prefer attribute-based selectors tied to test-specific attributes that developers add explicitly for automation.',
                points: [
                    'By.id() — O(1) DOM lookup, most performant, use when stable IDs exist',
                    'By.cssSelector() — flexible, readable, supported by all browsers natively',
                    'By.xpath() — use for text-based or ancestor/sibling traversal only',
                    'By.linkText() / By.partialLinkText() — for anchor elements only',
                    'Relative locators (above, below, near) — Selenium 4 spatial discovery',
                ],
                syntax: {
                    code: `// Selector strategy examples — ordered by preference
WebElement byId       = driver.findElement(By.id("login-btn"));
WebElement byTestId   = driver.findElement(By.cssSelector("[data-testid='submit']"));
WebElement byCss      = driver.findElement(By.cssSelector("form.login input[type='email']"));
WebElement byText     = driver.findElement(By.xpath("//button[normalize-space()='Sign In']"));

// Selenium 4 relative locators
WebElement label      = driver.findElement(By.id("email-label"));
WebElement inputNear  = driver.findElement(
    RelativeLocator.with(By.tagName("input")).below(label));`,
                    lang: 'Java',
                },
            },
            {
                title: 'Handling Dynamic & Shadow DOM Elements',
                content: 'Modern SPAs frequently render elements asynchronously and use Shadow DOM for encapsulation. Standard findElement calls cannot pierce Shadow DOM boundaries — you must use JavaScript execution or the Selenium 4 getShadowRoot() API.',
                points: [
                    'Shadow DOM elements are inaccessible to standard CSS/XPath selectors',
                    'Use element.getShadowRoot() to get a SearchContext for shadow children',
                    'JavaScript executor can pierce shadow roots: arguments[0].shadowRoot.querySelector()',
                    'Always combine shadow DOM access with explicit waits to avoid StaleElementReference',
                ],
                syntax: {
                    code: `// Accessing Shadow DOM in Selenium 4
WebElement host   = driver.findElement(By.cssSelector("my-component"));
SearchContext shadow = host.getShadowRoot();
WebElement inner  = shadow.findElement(By.cssSelector("input.inner-field"));
inner.sendKeys("test value");

// Alternative: JavaScript executor
JavascriptExecutor js = (JavascriptExecutor) driver;
WebElement el = (WebElement) js.executeScript(
    "return arguments[0].shadowRoot.querySelector('input')", host);`,
                    lang: 'Java',
                },
            },
        ],
        lab: {
            mission: 'Navigate to https://www.saucedemo.com — a public Sauce Labs demo shopping app. Locate the username field using a CSS id selector, the password field using XPath, enter credentials (standard_user / secret_sauce), and submit the login form. Verify you land on /inventory.html.',
            starter: `import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.locators.RelativeLocator;

public class Lab02 {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        // REAL SITE: https://www.saucedemo.com
        // Credentials: standard_user / secret_sauce
        driver.get("https://www.saucedemo.com");

        // TODO: Find username input using cssSelector (id=user-name)

        // TODO: Find password input using xpath (id=password)

        // TODO: Enter credentials: standard_user / secret_sauce

        // TODO: Click login button using cssSelector (id=login-button)

        // TODO: Print current URL and quit
    }
}`,
            solution: `import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;

public class Lab02 {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        driver.get("https://www.saucedemo.com");

        WebElement username = driver.findElement(By.cssSelector("#user-name"));
        username.sendKeys("standard_user");

        WebElement password = driver.findElement(By.xpath("//input[@id='password']"));
        password.sendKeys("secret_sauce");

        driver.findElement(By.cssSelector("#login-button")).click();

        System.out.println("URL: " + driver.getCurrentUrl()); // https://www.saucedemo.com/inventory.html
        assert driver.getCurrentUrl().contains("inventory") : "Login failed";
        driver.quit();
    }
}`,
            validation: [
                { id: 'v1', label: 'CSS selector for username', keywords: ['cssSelector', 'user-name'] },
                { id: 'v2', label: 'XPath for password', keywords: ['By.xpath', 'password'] },
                { id: 'v3', label: 'Credentials entered', keywords: ['sendKeys', 'standard_user', 'secret_sauce'] },
                { id: 'v4', label: 'Login button clicked', keywords: ['login-button'] },
                { id: 'v5', label: 'URL assertion', keywords: ['getCurrentUrl', 'inventory'] },
            ],
        },
    },
    {
        id: 'sel-03',
        title: 'Explicit Waits & Synchronization Patterns',
        framework: 'selenium',
        module: 'Module 2 — Synchronization',
        duration: '65 min',
        xp: 350,
        difficulty: 'Advanced',
        theory: [
            {
                title: 'Why Implicit Waits Are Insufficient',
                content: 'Implicit waits apply a global polling timeout to every findElement call. While convenient, they interact poorly with explicit waits, cause unpredictable behavior when combined, and cannot express complex conditions like "wait until element text equals X". The industry standard is to disable implicit waits entirely and use WebDriverWait with ExpectedConditions exclusively.',
                points: [
                    'Implicit + explicit waits combined can cause waits up to their sum — a known Selenium bug',
                    'WebDriverWait polls every 500ms by default; configurable via FluentWait',
                    'ExpectedConditions provides 30+ built-in conditions covering visibility, clickability, text, URL',
                    'Custom ExpectedCondition<T> allows waiting for any arbitrary state',
                ],
                syntax: {
                    code: `// Professional explicit wait pattern
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import java.time.Duration;

WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));

// Wait for element to be clickable
WebElement btn = wait.until(
    ExpectedConditions.elementToBeClickable(By.id("submit")));

// Wait for text to appear
wait.until(ExpectedConditions.textToBePresentInElementLocated(
    By.cssSelector(".status"), "Success"));

// Custom condition — wait until JS returns true
wait.until(d -> (Boolean) ((JavascriptExecutor) d)
    .executeScript("return document.readyState === 'complete'"));`,
                    lang: 'Java',
                },
            },
            {
                title: 'FluentWait & Polling Strategies',
                content: 'FluentWait extends WebDriverWait with configurable polling intervals and exception ignoring. This is essential for elements that flicker in and out of the DOM during animations, or for APIs that return intermittent results.',
                points: [
                    'withTimeout() — maximum time to wait before throwing TimeoutException',
                    'pollingEvery() — how frequently to evaluate the condition (default 500ms)',
                    'ignoring() — exception types to suppress during polling (e.g., NoSuchElementException)',
                    'withMessage() — custom failure message for better diagnostics',
                ],
                syntax: {
                    code: `// FluentWait with custom polling
import org.openqa.selenium.support.ui.FluentWait;

FluentWait<WebDriver> fluentWait = new FluentWait<>(driver)
    .withTimeout(Duration.ofSeconds(20))
    .pollingEvery(Duration.ofMillis(300))
    .ignoring(NoSuchElementException.class)
    .ignoring(StaleElementReferenceException.class)
    .withMessage("Element did not appear within 20 seconds");

WebElement el = fluentWait.until(
    ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".toast")));`,
                    lang: 'Java',
                },
            },
        ],
        lab: {
            mission: 'Navigate to https://demoqa.com/login — a public practice site by ToolsQA. Use WebDriverWait (15s) to wait for the username input to be clickable, then enter credentials (Username: "student", Password: "Password123"). Use FluentWait with 300ms polling, ignoring NoSuchElementException, to find the logout button after login.',
            starter: `import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;
import java.time.Duration;

public class Lab03 {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        // REAL SITE: https://demoqa.com/login
        // Credentials: student / Password123
        driver.get("https://demoqa.com/login");

        // TODO: Create WebDriverWait with 15 second timeout

        // TODO: Wait for username input (id="userName") to be clickable

        // TODO: Type "student" in userName, "Password123" in password

        // TODO: Click the login button (id="login")

        // TODO: Create FluentWait with 300ms polling, ignore NoSuchElementException

        // TODO: Use fluentWait to find logout button (id="submit") after login

        driver.quit();
    }
}`,
            solution: `import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;
import java.time.Duration;

public class Lab03 {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        driver.get("https://demoqa.com/login");

        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(15));
        WebElement userInput = wait.until(
            ExpectedConditions.elementToBeClickable(By.id("userName")));
        userInput.sendKeys("student");
        driver.findElement(By.id("password")).sendKeys("Password123");
        driver.findElement(By.id("login")).click();

        FluentWait<WebDriver> fluentWait = new FluentWait<>(driver)
            .withTimeout(Duration.ofSeconds(20))
            .pollingEvery(Duration.ofMillis(300))
            .ignoring(NoSuchElementException.class);

        WebElement logoutBtn = fluentWait.until(
            ExpectedConditions.visibilityOfElementLocated(By.id("submit")));
        System.out.println("Logout button visible: " + logoutBtn.isDisplayed());
        driver.quit();
    }
}`,
            validation: [
                { id: 'v1', label: 'WebDriverWait created', keywords: ['new WebDriverWait'] },
                { id: 'v2', label: 'elementToBeClickable used', keywords: ['elementToBeClickable'] },
                { id: 'v3', label: 'Credentials entered', keywords: ['sendKeys', 'student', 'Password123'] },
                { id: 'v4', label: 'FluentWait configured', keywords: ['FluentWait', 'pollingEvery'] },
                { id: 'v5', label: 'Exception ignored', keywords: ['ignoring', 'NoSuchElementException'] },
            ],
        },
    },
    {
        id: 'sel-04',
        title: 'Page Object Model & Design Patterns',
        framework: 'selenium',
        module: 'Module 3 — Architecture',
        duration: '75 min',
        xp: 400,
        difficulty: 'Advanced',
        theory: [
            {
                title: 'Page Object Model (POM)',
                content: 'POM is the most widely adopted design pattern in enterprise test automation. It separates the "what to test" (test logic) from the "how to interact" (page interactions). Each page or component is represented as a class that encapsulates its locators and actions, exposing a fluent API to tests. This reduces duplication and confines selector changes to a single class.',
                points: [
                    'One class per page or significant component — LoginPage, DashboardPage, etc.',
                    'Locators declared as private fields using @FindBy annotations with PageFactory',
                    'Action methods return Page Objects to enable fluent chaining: login().navigateTo()',
                    'Never put assertions inside Page Objects — keep them in test classes',
                    'Use BasePage for shared utilities: waitForPageLoad, scrollTo, takeScreenshot',
                ],
                syntax: {
                    code: `// LoginPage.java — canonical POM implementation
import org.openqa.selenium.*;
import org.openqa.selenium.support.*;
import org.openqa.selenium.support.ui.*;
import java.time.Duration;

public class LoginPage {
    private final WebDriver driver;
    private final WebDriverWait wait;

    @FindBy(id = "email")       private WebElement emailInput;
    @FindBy(id = "password")    private WebElement passwordInput;
    @FindBy(css = "[type=submit]") private WebElement submitBtn;
    @FindBy(css = ".error-msg") private WebElement errorMessage;

    public LoginPage(WebDriver driver) {
        this.driver = driver;
        this.wait   = new WebDriverWait(driver, Duration.ofSeconds(15));
        PageFactory.initElements(driver, this);
    }

    public DashboardPage loginAs(String email, String password) {
        wait.until(ExpectedConditions.elementToBeClickable(emailInput));
        emailInput.clear();
        emailInput.sendKeys(email);
        passwordInput.sendKeys(password);
        submitBtn.click();
        return new DashboardPage(driver);
    }

    public String getErrorMessage() {
        return wait.until(ExpectedConditions.visibilityOf(errorMessage)).getText();
    }
}`,
                    lang: 'Java',
                },
            },
        ],
        lab: {
            mission: 'Apply POM to the real Sauce Demo site (https://www.saucedemo.com). Build a SauceDemoLoginPage using @FindBy for userName, password, and the login button. The loginAs() method should enter "standard_user" / "secret_sauce" and return an InventoryPage. Assert that the inventory page URL contains "inventory".',
            starter: `import org.openqa.selenium.*;
import org.openqa.selenium.support.*;
import org.openqa.selenium.chrome.ChromeDriver;

// REAL SITE: https://www.saucedemo.com
// Credentials: standard_user / secret_sauce

// TODO: Implement SauceDemoLoginPage with PageFactory
class SauceDemoLoginPage {
    private WebDriver driver;

    // TODO: @FindBy for id="user-name"
    // TODO: @FindBy for id="password"
    // TODO: @FindBy for id="login-button"

    // TODO: Constructor with PageFactory.initElements

    // TODO: loginAs(String user, String pass) returns InventoryPage
}

class InventoryPage {
    private WebDriver driver;
    public InventoryPage(WebDriver driver) { this.driver = driver; }
    public String getUrl() { return driver.getCurrentUrl(); }
}

public class Lab04 {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        driver.get("https://www.saucedemo.com");

        // TODO: Instantiate SauceDemoLoginPage and call loginAs
        // TODO: Assert inventoryPage.getUrl() contains "inventory"
        driver.quit();
    }
}`,
            solution: `import org.openqa.selenium.*;
import org.openqa.selenium.support.*;
import org.openqa.selenium.chrome.ChromeDriver;

class SauceDemoLoginPage {
    private WebDriver driver;

    @FindBy(id = "user-name")    private WebElement userInput;
    @FindBy(id = "password")     private WebElement passInput;
    @FindBy(id = "login-button") private WebElement loginBtn;

    public SauceDemoLoginPage(WebDriver driver) {
        this.driver = driver;
        PageFactory.initElements(driver, this);
    }

    public InventoryPage loginAs(String user, String pass) {
        userInput.sendKeys(user);
        passInput.sendKeys(pass);
        loginBtn.click();
        return new InventoryPage(driver);
    }
}

class InventoryPage {
    private WebDriver driver;
    public InventoryPage(WebDriver driver) { this.driver = driver; }
    public String getUrl() { return driver.getCurrentUrl(); }
}

public class Lab04 {
    public static void main(String[] args) {
        WebDriver driver = new ChromeDriver();
        driver.get("https://www.saucedemo.com");
        SauceDemoLoginPage loginPage = new SauceDemoLoginPage(driver);
        InventoryPage inventory = loginPage.loginAs("standard_user", "secret_sauce");
        assert inventory.getUrl().contains("inventory") : "Expected inventory page";
        System.out.println("POM login successful: " + inventory.getUrl());
        driver.quit();
    }
}`,
            validation: [
                { id: 'v1', label: '@FindBy annotations used', keywords: ['@FindBy'] },
                { id: 'v2', label: 'PageFactory initialized', keywords: ['PageFactory.initElements'] },
                { id: 'v3', label: 'loginAs method implemented', keywords: ['loginAs', 'standard_user', 'secret_sauce'] },
                { id: 'v4', label: 'Returns InventoryPage', keywords: ['InventoryPage'] },
                { id: 'v5', label: 'URL assertion', keywords: ['getUrl', 'inventory'] },
            ],
        },
    },

    // ─── PLAYWRIGHT ────────────────────────────────────────────────────────────
    {
        id: 'pw-00',
        title: 'Installation & Hello World',
        framework: 'playwright',
        module: 'Module 0 — Environment Setup',
        duration: '30 min',
        xp: 200,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'Installing Playwright',
                content: 'Playwright requires Node.js. It comes with its own browser binaries, ensuring perfect compatibility and eliminating the need to download independent WebDrivers.',
                points: [
                    'Install Node.js from nodejs.org.',
                    'Open your terminal and run: npm init playwright@latest',
                    'This scaffolds a new project, installs Playwright, and downloads necessary browsers (Chromium, Firefox, WebKit).',
                    'By default, scaffolding includes a comprehensive example test.'
                ],
                syntax: {
                    code: `# Try this command to set up Playwright in a new folder:
npm init playwright@latest

# Follow the interactive prompts. Once done, you can run tests with:
npx playwright test

# To run tests with a visual UI explorer:
npx playwright test --ui`,
                    lang: 'bash',
                }
            }
        ],
        lab: {
            mission: 'Write a terminal command sequence to scaffold a Playwright project and execute the tests using the visual UI mode.',
            starter: `# Write the commands you would type in the terminal below
// TODO: scaffold playwright project
// TODO: run tests with UI mode`,
            solution: `npm init playwright@latest
npx playwright test --ui`,
            validation: [
                { id: 'v1', label: 'Scaffold Command', keywords: ['npm init playwright'] },
                { id: 'v2', label: 'Run with UI Command', keywords: ['npx playwright test --ui'] }
            ]
        }
    },
    {
        id: 'pw-01',
        title: 'Playwright Architecture & Auto-Waiting',
        framework: 'playwright',
        module: 'Module 1 — Core Concepts',
        duration: '55 min',
        xp: 280,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'How Playwright Differs from Selenium',
                content: 'Playwright communicates with browsers via the Chrome DevTools Protocol (CDP) for Chromium, and equivalent protocols for Firefox and WebKit. Unlike Selenium\'s HTTP-based WebDriver, this gives Playwright direct access to browser internals: network interception, console logs, service workers, and JavaScript execution — all without additional configuration.',
                points: [
                    'Single API for Chromium, Firefox, and WebKit — true cross-browser parity',
                    'Auto-waiting: every action waits for the element to be actionable before proceeding',
                    'Built-in network interception via page.route() — no proxy configuration needed',
                    'Isolated browser contexts replace the need for separate driver instances',
                    'Trace viewer provides a timeline of every action, screenshot, and network request',
                ],
                syntax: {
                    code: `// Playwright Java — browser context isolation
import com.microsoft.playwright.*;

try (Playwright playwright = Playwright.create()) {
    Browser browser = playwright.chromium().launch(
        new BrowserType.LaunchOptions().setHeadless(false));

    // Each context is a fresh browser profile
    BrowserContext ctx = browser.newContext(new Browser.NewContextOptions()
        .setViewportSize(1920, 1080)
        .setLocale("en-US"));

    Page page = ctx.newPage();
    page.navigate("https://zenit.ai");

    // Auto-waiting — no explicit wait needed
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions()
        .setName("Get Started")).click();

    System.out.println(page.title());
    ctx.close();
}`,
                    lang: 'Java',
                },
            },
            {
                title: 'Locator API & Semantic Selectors',
                content: 'Playwright\'s Locator API is lazy — it does not query the DOM until an action is performed. This eliminates StaleElementReferenceException entirely. The recommended approach is semantic locators (getByRole, getByLabel, getByText) that mirror how users perceive the page, making tests more resilient to implementation changes.',
                points: [
                    'getByRole() — ARIA role-based, most resilient to DOM restructuring',
                    'getByLabel() — finds form inputs by their associated label text',
                    'getByPlaceholder() — targets inputs by placeholder attribute',
                    'getByTestId() — uses data-testid attribute, requires developer cooperation',
                    'locator().filter() — chains conditions: visible, has-text, has-child',
                ],
                syntax: {
                    code: `// Semantic locator examples
Locator submitBtn = page.getByRole(AriaRole.BUTTON, 
    new Page.GetByRoleOptions().setName("Submit"));

Locator emailField = page.getByLabel("Email address");
Locator searchBox  = page.getByPlaceholder("Search frameworks...");

// Chaining and filtering
Locator activeItems = page.locator(".list-item")
    .filter(new Locator.FilterOptions().setHasText("Active"));

// Assertions — built-in auto-retry
assertThat(submitBtn).isVisible();
assertThat(emailField).isEnabled();
assertThat(page).hasTitle(Pattern.compile("Zenit.*"));`,
                    lang: 'Java',
                },
            },
        ],
        lab: {
            mission: 'Using Playwright Java, navigate to https://demoqa.com/login (real site — ToolsQA practice). Create a 1280x720 context, use getByPlaceholder to fill "UserName" and "Password" fields with "student" and "Password123", click Login, and assert the resulting URL does not contain "login" (confirming successful redirect).',
            starter: `import com.microsoft.playwright.*;
import com.microsoft.playwright.options.AriaRole;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class PwLab01 {
    public static void main(String[] args) {
        // REAL SITE: https://demoqa.com/login
        // Credentials: student / Password123
        // TODO: Create Playwright instance in try-with-resources

        // TODO: Launch Chromium browser

        // TODO: Create context with 1280x720 viewport

        // TODO: Navigate to https://demoqa.com/login

        // TODO: Fill username using getByPlaceholder("UserName")

        // TODO: Fill password using getByPlaceholder("Password")

        // TODO: Click login button using getByRole BUTTON "Login"

        // TODO: Assert page URL does not contain "login"
    }
}`,
            solution: `import com.microsoft.playwright.*;
import com.microsoft.playwright.options.AriaRole;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import java.util.regex.Pattern;

public class PwLab01 {
    public static void main(String[] args) {
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch(
                new BrowserType.LaunchOptions().setHeadless(false));

            BrowserContext ctx = browser.newContext(
                new Browser.NewContextOptions().setViewportSize(1280, 720));

            Page page = ctx.newPage();
            page.navigate("https://demoqa.com/login");

            page.getByPlaceholder("UserName").fill("student");
            page.getByPlaceholder("Password").fill("Password123");
            page.getByRole(AriaRole.BUTTON,
                new Page.GetByRoleOptions().setName("Login")).click();

            // After login, URL should redirect away from /login
            assertThat(page).hasURL(Pattern.compile(".*profile.*"));
            ctx.close();
        }
    }
}`,
            validation: [
                { id: 'v1', label: 'Playwright.create() used', keywords: ['Playwright.create'] },
                { id: 'v2', label: 'Context with viewport', keywords: ['newContext', 'setViewportSize'] },
                { id: 'v3', label: 'getByPlaceholder used', keywords: ['getByPlaceholder', 'UserName', 'Password'] },
                { id: 'v4', label: 'getByRole for login', keywords: ['getByRole', 'Login'] },
                { id: 'v5', label: 'URL assertion present', keywords: ['assertThat', 'hasURL'] },
            ],
        },
    },
    {
        id: 'pw-02',
        title: 'Network Interception & API Mocking',
        framework: 'playwright',
        module: 'Module 2 — Advanced Control',
        duration: '70 min',
        xp: 380,
        difficulty: 'Advanced',
        theory: [
            {
                title: 'Intercepting Network Requests',
                content: 'Playwright\'s page.route() API intercepts HTTP requests matching a URL pattern before they reach the network. This enables mocking API responses, blocking third-party scripts, modifying request headers, and simulating error conditions — all without a proxy server. This is one of Playwright\'s most powerful differentiators from Selenium.',
                points: [
                    'page.route(pattern, handler) — intercepts matching requests',
                    'route.fulfill() — respond with mock data, status code, and headers',
                    'route.abort() — simulate network failure or blocked resource',
                    'route.continue() — pass through with optional modifications',
                    'page.waitForResponse() — await a specific network response before proceeding',
                ],
                syntax: {
                    code: `// Mock an API endpoint to return controlled data
page.route("**/api/users", route -> {
    route.fulfill(new Route.FulfillOptions()
        .setStatus(200)
        .setContentType("application/json")
        .setBody("[{\"id\":1,\"name\":\"Zenit User\"}]"));
});

// Intercept and modify request headers
page.route("**/api/**", route -> {
    Map<String, String> headers = new HashMap<>(route.request().headers());
    headers.put("X-Test-Header", "zenit-automation");
    route.resume(new Route.ResumeOptions().setHeaders(headers));
});

// Block all analytics scripts
page.route("**/(analytics|tracking|gtm)/**", Route::abort);

// Wait for a specific response
Response resp = page.waitForResponse("**/api/login",
    () -> page.getByRole(AriaRole.BUTTON, 
        new Page.GetByRoleOptions().setName("Login")).click());
System.out.println("Status: " + resp.status());`,
                    lang: 'Java',
                },
            },
        ],
        lab: {
            mission: 'Use page.route() to intercept GET requests to **/api/users and return a mocked JSON response. Then navigate to https://reqres.in/api/users?page=2 (a real public REST API) WITHOUT a route, capture the real response, and assert its status is 200 and the JSON body contains a "data" key. Compare mocked vs real.',
            starter: `import com.microsoft.playwright.*;

public class PwLab02 {
    public static void main(String[] args) {
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch();
            Page page = browser.newPage();

            // PART 1: Mock interception
            // TODO: Set up route to intercept **/api/mock-users
            // Return: [{"id":1,"name":"Mock User"}], status 200

            // TODO: Navigate to about:blank and trigger the mock

            // PART 2: Real API response
            // TODO: Navigate to https://reqres.in/api/users?page=2
            // TODO: Capture the response using waitForResponse
            // TODO: Assert response.status() == 200
            // TODO: Assert response.text() contains "data"

            browser.close();
        }
    }
}`,
            solution: `import com.microsoft.playwright.*;

public class PwLab02 {
    public static void main(String[] args) {
        try (Playwright playwright = Playwright.create()) {
            Browser browser = playwright.chromium().launch();
            Page page = browser.newPage();

            // Part 1: Mock route setup
            page.route("**/api/mock-users", route ->
                route.fulfill(new Route.FulfillOptions()
                    .setStatus(200)
                    .setContentType("application/json")
                    .setBody("[{\"id\":1,\"name\":\"Mock User\"}]")));

            // Part 2: Real API call to reqres.in
            Response resp = page.waitForResponse(
                "https://reqres.in/api/users?page=2",
                () -> page.navigate("https://reqres.in/api/users?page=2"));

            assert resp.status() == 200 : "Expected 200, got " + resp.status();
            String body = resp.text();
            assert body.contains("data") : "Response should contain 'data' key";
            System.out.println("Real API status: " + resp.status());
            System.out.println("Body preview: " + body.substring(0, 100) + "...");
            browser.close();
        }
    }
}`,
            validation: [
                { id: 'v1', label: 'page.route() configured', keywords: ['page.route', 'api/mock-users'] },
                { id: 'v2', label: 'Mock response fulfilled', keywords: ['route.fulfill', 'setStatus'] },
                { id: 'v3', label: 'Real API navigation', keywords: ['reqres.in', 'api/users'] },
                { id: 'v4', label: 'Response captured', keywords: ['waitForResponse'] },
                { id: 'v5', label: 'Status and body assertions', keywords: ['resp.status', '200', 'body.contains', 'data'] },
            ],
        },
    },

    // ─── CYPRESS ───────────────────────────────────────────────────────────────
    {
        id: 'cy-00',
        title: 'Installation & The Test Runner',
        framework: 'cypress',
        module: 'Module 0 — Environment Setup',
        duration: '30 min',
        xp: 200,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'Installing Cypress',
                content: 'Cypress is an npm package that brings its own visual test runner. It operates entirely differently from Selenium by running directly inside the same run-loop as your application.',
                points: [
                    'Install Node.js.',
                    'Initialize a project via: npm init -y',
                    'Install Cypress as a dev dependency via: npm install cypress --save-dev',
                    'Open the visual Test Runner via: npx cypress open'
                ],
                syntax: {
                    code: `# Try these commands in your terminal:
npm init -y
npm install cypress --save-dev

# This opens the magical Cypress UI where you configure E2E testing
npx cypress open`,
                    lang: 'bash',
                }
            }
        ],
        lab: {
            mission: 'Write the command sequence to install cypress as a developer dependency and open the Test Runner.',
            starter: `# Terminal commands
// TODO: install cypress
// TODO: open cypress test runner`,
            solution: `npm install cypress --save-dev
npx cypress open`,
            validation: [
                { id: 'v1', label: 'Install Command', keywords: ['npm install cypress'] },
                { id: 'v2', label: 'Open Command', keywords: ['npx cypress open'] }
            ]
        }
    },
    {
        id: 'cy-01',
        title: 'Cypress Architecture & Command Queue',
        framework: 'cypress',
        module: 'Module 1 — Foundations',
        duration: '50 min',
        xp: 260,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'The Cypress Execution Model',
                content: 'Cypress runs inside the browser alongside your application — not in a separate process communicating over HTTP. This gives it direct access to the DOM, window object, and application state. Commands are queued and executed asynchronously in sequence; you never need to return Promises or use async/await.',
                points: [
                    'Commands are enqueued, not executed immediately — cy.get() returns a Chainable, not an element',
                    'Automatic retry: cy.get() retries for up to 4 seconds by default before failing',
                    'cy.intercept() replaces cy.route() — works with fetch, XHR, and WebSockets',
                    'Aliases created with .as() can be referenced with cy.get("@alias") across commands',
                    'cy.wrap() bridges Cypress commands with plain JavaScript values',
                ],
                syntax: {
                    code: `// Cypress command queue — declarative style
describe('SauceDemo Login', () => {
  beforeEach(() => {
    // Intercept is NOT needed for saucedemo (no real API), but shown for pattern:
    cy.intercept('POST', '/api/auth/login').as('loginRequest');
    cy.visit('https://www.saucedemo.com');
  });

  it('authenticates standard_user successfully', () => {
    cy.get('#user-name').type('standard_user');
    cy.get('#password').type('secret_sauce{enter}');

    // After login, URL changes to /inventory.html
    cy.url().should('include', '/inventory.html');
    cy.get('.title').should('contain.text', 'Products');
  });
});`,
                    lang: 'JavaScript',
                },
            },
            {
                title: 'Custom Commands & Reusability',
                content: 'Cypress custom commands extend cy with domain-specific actions, eliminating repetition across test files. Defined in cypress/support/commands.js, they integrate seamlessly into the command queue and support TypeScript type definitions.',
                points: [
                    'Cypress.Commands.add() registers a new command globally',
                    'Custom commands can accept arguments and chain other cy commands',
                    'Use Cypress.Commands.overwrite() to modify built-in command behavior',
                    'TypeScript: declare namespace Cypress { interface Chainable { login(email, pass): void } }',
                ],
                syntax: {
                    code: `// cypress/support/commands.js — reusable login command
Cypress.Commands.add('loginToSauceDemo', (username, password) => {
  cy.session([username, password], () => {
    cy.visit('https://www.saucedemo.com');
    cy.get('#user-name').type(username);
    cy.get('#password').type(password);
    cy.get('#login-button').click();
    cy.url().should('include', '/inventory.html');
  });
});

// Usage in tests
cy.loginToSauceDemo('standard_user', 'secret_sauce');
cy.visit('https://www.saucedemo.com/inventory.html');`,
                    lang: 'JavaScript',
                },
            },
        ],
        lab: {
            mission: 'Write a Cypress test that visits https://www.saucedemo.com, types credentials (standard_user / secret_sauce), submits the form, and asserts the URL changes to /inventory.html and the page title is "Products". Use cy.intercept() to observe any API calls during login.',
            starter: `// cypress/e2e/lab01.cy.js
describe('Sauce Demo Login Lab', () => {
  it('logs in with valid credentials and reaches inventory', () => {
    // REAL SITE: https://www.saucedemo.com
    // Credentials: standard_user / secret_sauce

    // TODO: Intercept all POST requests to observe network activity

    // TODO: Visit https://www.saucedemo.com

    // TODO: Type "standard_user" into #user-name

    // TODO: Type "secret_sauce" into #password

    // TODO: Click #login-button

    // TODO: Assert URL includes "/inventory.html"

    // TODO: Assert .title text equals "Products"
  });
});`,
            solution: `// cypress/e2e/lab01.cy.js
describe('Sauce Demo Login Lab', () => {
  it('logs in with valid credentials and reaches inventory', () => {
    cy.intercept('**').as('anyRequest'); // observe network
    cy.visit('https://www.saucedemo.com');
    cy.get('#user-name').type('standard_user');
    cy.get('#password').type('secret_sauce');
    cy.get('#login-button').click();
    cy.url().should('include', '/inventory.html');
    cy.get('.title').should('have.text', 'Products');
  });
});`,
            validation: [
                { id: 'v1', label: 'cy.intercept configured', keywords: ['cy.intercept'] },
                { id: 'v2', label: 'Visited saucedemo', keywords: ['cy.visit', 'saucedemo.com'] },
                { id: 'v3', label: 'Credentials entered', keywords: ['standard_user', 'secret_sauce', '.type('] },
                { id: 'v4', label: 'Login button clicked', keywords: ['login-button', '.click()'] },
                { id: 'v5', label: 'URL and title asserted', keywords: ['cy.url', 'inventory', '.title', 'Products'] },
            ],
        },
    },

    // ─── VIBIUM ────────────────────────────────────────────────────────────────

    {
        id: 'vib-00',
        title: 'Vibium Setup & Agentic Interface',
        framework: 'vibium',
        module: 'Module 0 — Environment Setup',
        duration: '30 min',
        xp: 200,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'Getting Started with Vibium AI',
                content: 'Vibium is a modern AI-agentic automation framework. Unlike traditional tools, it requires minimal setup beyond Node.js and an API endpoint configuration.',
                points: [
                    'Install Node.js.',
                    'Install the Vibium core package: npm install vibium',
                    'Configure your VIBE_KEY and VIBE_ENDPOINT in your .env file.',
                    'Vibium supports most modern browsers via its built-in driver orchestration.'
                ],
                syntax: {
                    code: `# Install Vibium
npm install vibium

# Check version
npx vibium --version`,
                    lang: 'bash',
                }
            }
        ],
        lab: {
            mission: 'Write the command to install Vibium and verify its version.',
            starter: `# Terminal commands
// TODO: install vibium
// TODO: check version`,
            solution: `npm install vibium
npx vibium --version`,
            validation: [
                { id: 'v1', label: 'Install Command', keywords: ['npm install vibium'] },
                { id: 'v2', label: 'Version Command', keywords: ['vibium --version'] }
            ]
        }
    },
    {
        id: 'vib-01',
        title: 'Intent-Based Automation with Vibium AI',
        framework: 'vibium',
        module: 'Module 1 — AI-Driven Testing',
        duration: '60 min',
        xp: 320,
        difficulty: 'Advanced',
        theory: [
            {
                title: 'From Selectors to Intent',
                content: 'Vibium AI replaces brittle CSS/XPath selectors with natural-language intent declarations. The AI engine interprets intent at runtime, resolving it to the most appropriate DOM element using a combination of semantic analysis, ARIA attributes, visual context, and ML-based element scoring. This fundamentally changes how automation scripts age — they remain valid even as the UI evolves.',
                points: [
                    'Intent resolution uses a multi-signal scoring model: text, role, position, visual weight',
                    'No selectors to maintain — scripts describe what to do, not how to find it',
                    'Self-healing: when an element moves, Vibium re-resolves intent automatically',
                    'Confidence scores expose how certain the AI is about each resolution',
                    'Audit trail logs every resolution decision for debugging and compliance',
                ],
                syntax: {
                    code: `// Vibium — intent-based automation
const { vibe } = require('vibium');

const session = await vibe.launch({ browser: 'chromium' });
// Using a real public site: automationexercise.com
await session.navigate('https://automationexercise.com');

// Natural language intent — no selectors needed
await session.intent('click the Signup / Login link in the navigation');
await session.intent('type "testuser@example.com" into the email input under Login');
await session.intent('type "TestPass123" into the password field and click Login');

// Structured intent with confidence threshold
const result = await session.resolve({
  intent: 'find the logged-in user account name in the header',
  minConfidence: 0.85,
});
console.log(\`Resolved with \${result.confidence * 100}% confidence\`);
await result.element.click();`,
                    lang: 'JavaScript',
                },
            },
        ],
        lab: {
            mission: 'Write a Vibium script that launches a browser, navigates to https://automationexercise.com (a real public e-commerce practice site), uses session.intent() to click on the "Products" navigation link, then uses session.resolve() to find all product cards with minConfidence 0.75 and assert at least one is found.',
            starter: `const { vibe } = require('vibium');

async function main() {
  const session = await vibe.launch({ browser: 'chromium' });

  // REAL SITE: https://automationexercise.com
  // TODO: Navigate to https://automationexercise.com

  // TODO: Use intent to click the "Products" link

  // TODO: Use intent to wait for the product list to appear

  // TODO: Use session.resolve() to find all product items with minConfidence 0.75

  // TODO: Assert results.length > 0 and print count

  await session.close();
}
main();`,
            solution: `const { vibe } = require('vibium');

async function main() {
  const session = await vibe.launch({ browser: 'chromium' });
  await session.navigate('https://automationexercise.com');
  await session.intent('click the Products link in the top navigation bar');
  await session.intent('wait for the product grid to be visible');

  const results = await session.resolve({
    intent: 'find all product cards in the product list',
    minConfidence: 0.75,
  });

  console.assert(results.length > 0, 'Expected at least one product card');
  console.log(\`Found \${results.length} products on the page\`);
  await session.close();
}
main();`,
            validation: [
                { id: 'v1', label: 'vibe.launch() called', keywords: ['vibe.launch'] },
                { id: 'v2', label: 'session.navigate() used', keywords: ['session.navigate', 'zenit.ai'] },
                { id: 'v3', label: 'Intent for search', keywords: ['session.intent', 'search'] },
                { id: 'v4', label: 'session.resolve() used', keywords: ['session.resolve', 'minConfidence'] },
                { id: 'v5', label: 'Results assertion', keywords: ['assert', 'results.length'] },
            ],
        },
    },

    // ─── APPIUM ────────────────────────────────────────────────────────────────
    {
        id: 'app-00',
        title: 'Complete Environment Setup & Installation',
        framework: 'appium',
        module: 'Module 0 — Environment Setup',
        duration: '90 min',
        xp: 450,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'Mandatory Environment Variables',
                content: 'Mobile automation requires a strict toolchain. For Android, you need Java, the Android SDK, and Node.js. Setting up environment variables correctly is the #1 hurdle for beginners.',
                points: [
                    'Install JDK (11 or 17) and set JAVA_HOME (e.g., C:\\Program Files\\Java\\jdk-17). Add %JAVA_HOME%\\bin to PATH.',
                    'Install Android Studio. Open the SDK Manager and install Android SDK Platform-Tools.',
                    'Set ANDROID_HOME environment variable to your SDK path (e.g., C:\\Users\\Name\\AppData\\Local\\Android\\Sdk).',
                    'Add %ANDROID_HOME%\\platform-tools and %ANDROID_HOME%\\emulator to your PATH.'
                ],
                syntax: {
                    code: `# Verify your environment setup in the terminal
java -version
# Should output java version "17.x.x"

adb version
# Should output Android Debug Bridge version

# To see attached devices/emulators:
adb devices`,
                    lang: 'bash',
                },
            },
            {
                title: 'Installing Node.js, Appium 2.x & Drivers',
                content: 'Appium 2 decoupled the server from the drivers. You install the lightweight server via NPM, then explicitly install the drivers you need.',
                points: [
                    'Install Node.js from nodejs.org.',
                    'Open terminal and type: npm install -g appium',
                    'Install the Android driver by typing: appium driver install uiautomator2',
                    'Optional: Install appium-doctor (npm install -g appium-doctor) and run "appium-doctor --android" to verify your setup.'
                ],
                syntax: {
                    code: `# Try these commands in this exact sequence:
npm install -g appium
appium driver install uiautomator2

# Start the Appium server
appium

# Output should look like:
# [http] server listening on 0.0.0.0:4723
# [Appium] Available drivers:
# [Appium]   - uiautomator2@X.X.X (automationName 'UiAutomator2')`,
                    lang: 'bash',
                },
            }
        ],
        lab: {
            mission: 'Verify your environment. Write a terminal command sequence to check java version, adb version, install appium globally, install the uiautomator2 driver, and finally start the appium server.',
            starter: `# Write the commands you would type in the terminal below
// TODO: check java version
// TODO: check adb devices
// TODO: install appium
// TODO: install uiautomator2 driver
// TODO: run appium server
`,
            solution: `java -version
adb devices
npm install -g appium
appium driver install uiautomator2
appium`,
            validation: [
                { id: 'v1', label: 'Checked Java', keywords: ['java -version'] },
                { id: 'v2', label: 'Checked ADB', keywords: ['adb devices'] },
                { id: 'v3', label: 'Installed Appium', keywords: ['npm install -g appium'] },
                { id: 'v4', label: 'Installed Driver', keywords: ['appium driver install uiautomator2'] },
                { id: 'v5', label: 'Started Appium', keywords: ['\nappium'] }
            ],
        },
    },
    {
        id: 'app-01',
        title: 'Appium Inspector & Hello World',
        framework: 'appium',
        module: 'Module 1 — First App Launch',
        duration: '75 min',
        xp: 400,
        difficulty: 'Foundational',
        theory: [
            {
                title: 'Connecting to Appium Inspector',
                content: 'Appium Inspector is a GUI tool to identify UI elements on your mobile app, similar to Chrome DevTools. You must download it separately from the Appium GitHub releases.',
                points: [
                    'Download Appium Inspector from: github.com/appium/appium-inspector/releases',
                    'Start your Appium server in the terminal by typing: appium',
                    'In Appium Inspector, set Remote Host to 127.0.0.1, Port to 4723, and Path to / (for Appium 2.x).',
                    'Pass Desired Capabilities as JSON representing your device and app. Click "Start Session".'
                ],
                syntax: {
                    code: `// Desired Capabilities JSON for Appium Inspector
{
  "platformName": "Android",
  "appium:automationName": "UiAutomator2",
  "appium:deviceName": "emulator-5554",
  "appium:app": "C:\\path\\to\\your\\app.apk",
  "appium:appWaitActivity": "*"
}`,
                    lang: 'json',
                },
            },
            {
                title: 'Hello World App Launch Script',
                content: 'To automate this in code, you use the Appium Java Client. We initialize an AndroidDriver with UiAutomator2Options to launch the app programmatically.',
                points: [
                    'Add io.appium:java-client dependency to your pom.xml.',
                    'Use UiAutomator2Options to define capabilities programmatically in Java.',
                    'Initialize AndroidDriver passing the Appium server URL (http://127.0.0.1:4723) and options.',
                    'Use driver.quit() to end the session.'
                ],
                syntax: {
                    code: `// Hello World Android Launch
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;
import java.net.URL;

public class HelloWorld {
    public static void main(String[] args) throws Exception {
        UiAutomator2Options options = new UiAutomator2Options()
            .setPlatformName("Android")
            .setAutomationName("UiAutomator2")
            .setDeviceName("emulator-5554")
            .setApp("C:/SampleApp.apk");

        // Connect to the local Appium server
        AndroidDriver driver = new AndroidDriver(
            new URL("http://127.0.0.1:4723"), options);

        System.out.println("App Launched Successfully!");
        
        Thread.sleep(3000);
        driver.quit(); // End session
    }
}`,
                    lang: 'Java',
                },
            }
        ],
        lab: {
            mission: 'Write a Hello World script that configures UiAutomator2Options for Android, connects to local Appium (http://127.0.0.1:4723), launches an app from "C:/MyStore.apk", and calls driver.quit()',
            starter: `import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;
import java.net.URL;

public class AppLab01 {
    public static void main(String[] args) throws Exception {
        // TODO: Create UiAutomator2Options
        // set platform name "Android"
        // set automation name "UiAutomator2"
        // set app "C:/MyStore.apk"

        // TODO: Initialize AndroidDriver with URL "http://127.0.0.1:4723" and options

        // TODO: Print a success message

        // TODO: Quit the driver
    }
}`,
            solution: `import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;
import java.net.URL;

public class AppLab01 {
    public static void main(String[] args) throws Exception {
        UiAutomator2Options options = new UiAutomator2Options()
            .setPlatformName("Android")
            .setAutomationName("UiAutomator2")
            .setApp("C:/MyStore.apk");

        AndroidDriver driver = new AndroidDriver(
            new URL("http://127.0.0.1:4723"), options);

        System.out.println("App launched!");

        driver.quit();
    }
}`,
            validation: [
                { id: 'v1', label: 'Options created', keywords: ['UiAutomator2Options'] },
                { id: 'v2', label: 'Automation Name', keywords: ['setAutomationName', 'UiAutomator2'] },
                { id: 'v3', label: 'App path set', keywords: ['setApp', 'MyStore.apk'] },
                { id: 'v4', label: 'Driver initialized', keywords: ['new AndroidDriver', '127.0.0.1:4723'] },
                { id: 'v5', label: 'Driver Quit', keywords: ['driver.quit'] }
            ],
        },
    },
    {
        id: 'app-02',
        title: 'Element Identification & Interactions',
        framework: 'appium',
        module: 'Module 2 — Scripting',
        duration: '75 min',
        xp: 450,
        difficulty: 'Advanced',
        theory: [
            {
                title: 'Mobile Locators extracted via Appium Inspector',
                content: 'Once the app is launched in Appium Inspector, click on elements to see their attributes. Mobile apps use accessibility IDs, resource-ids (Android), or XPaths. Accessibility IDs are the most reliable and cross-platform.',
                points: [
                    'accessibility-id corresponds to content-desc in Android and accessibilityIdentifier in iOS.',
                    'Use AppiumBy.accessibilityId("loginBtn") to locate elements natively.',
                    'resource-id mapping: AppiumBy.id("com.android.calculator2:id/digit_7").',
                    'Avoid XPath on mobile; it is computationally expensive and slow to evaluate the xml tree.'
                ],
                syntax: {
                    code: `// Finding and interacting with elements
import io.appium.java_client.AppiumBy;
import org.openqa.selenium.WebElement;

// Best practice: Accessibility ID
WebElement loginBtn = driver.findElement(AppiumBy.accessibilityId("login-button"));
loginBtn.click();

// Good: Resource ID
WebElement username = driver.findElement(AppiumBy.id("ai.zenit.app:id/email_input"));
username.sendKeys("test@zenit.ai");

// Android Specific: UiAutomator
WebElement submitBtn = driver.findElement(
    AppiumBy.androidUIAutomator("new UiSelector().text(\"Submit\")"));
submitBtn.click();`,
                    lang: 'Java',
                },
            }
        ],
        lab: {
            mission: 'Using the AndroidDriver, find the username input by id ("app:id/user"), enter "admin", find password by id ("app:id/pass"), enter "1234", and click the login button located by accessibilityId ("login_btn").',
            starter: `import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.AppiumBy;
// Assume driver is initialized

public class AppLab02 {
    public static void performLogin(AndroidDriver driver) {
        // TODO: Find username by AppiumBy.id("app:id/user") and use .sendKeys("admin")
        
        // TODO: Find password by AppiumBy.id("app:id/pass") and use .sendKeys("1234")
        
        // TODO: Find login button by AppiumBy.accessibilityId("login_btn") and use .click()
    }
}`,
            solution: `import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.AppiumBy;

public class AppLab02 {
    public static void performLogin(AndroidDriver driver) {
        driver.findElement(AppiumBy.id("app:id/user")).sendKeys("admin");
        driver.findElement(AppiumBy.id("app:id/pass")).sendKeys("1234");
        driver.findElement(AppiumBy.accessibilityId("login_btn")).click();
    }
}`,
            validation: [
                { id: 'v1', label: 'Username entered', keywords: ['AppiumBy.id', 'app:id/user', 'sendKeys', 'admin'] },
                { id: 'v2', label: 'Password entered', keywords: ['AppiumBy.id', 'app:id/pass', 'sendKeys', '1234'] },
                { id: 'v3', label: 'Login clicked', keywords: ['AppiumBy.accessibilityId', 'login_btn', 'click'] }
            ],
        },
    },
];
