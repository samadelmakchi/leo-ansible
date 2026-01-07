/*************************
 * Globals
 *************************/
let inventoryData = {};

// لیست ماژول‌ها به‌صورت سراسری
const modulesList = ["gateway", "portal", "portal_frontend", "lms", "file"];

/*************************
 * Validators
 *************************/
function isEnglish(value) {
    return /^[\x00-\x7F]*$/.test(value);
}

function isValidDomain(value) {
    return /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(value);
}

function isValidIP(value) {
    return /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){2}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(value);
}

/*************************
 * Fetch Inventory
 *************************/
fetch("/api/inventory")
    .then(res => res.json())
    .then(data => {
        inventoryData = data;
        loadCustomers();
        updateCustomerState();
    });

/*************************
 * Helpers
 *************************/
// ادغام متغیرهای مشتری با پیش‌فرض
function getCustomerVars(customer) {
    const customerVars = inventoryData.all.hosts[customer]?.vars || {};
    const defaultVars = inventoryData.all.vars || {};
    return { ...defaultVars, ...customerVars };
}

/*************************
 * Update Customer State & Reload Page
 *************************/
function updateCustomerState() {
    const select = document.getElementById("customerSelect");
    const customer = select.value;

    if (!inventoryData.all.hosts[customer]) return;

    const mergedVars = getCustomerVars(customer);

    // بروزرسانی متن وضعیت
    const stateText = document.getElementById("customerStateText");
    stateText.innerText = mergedVars.customer_state === "up" ? "فعال" : "غیرفعال";

    // بروزرسانی radio
    const radios = document.querySelectorAll('input[name="customer_state"]');
    radios.forEach(r => r.checked = r.value === mergedVars.customer_state);

    // بروزرسانی تمام تب‌ها
    renderTabs(mergedVars);
}


/*************************
 * Load Customers
 *************************/
function loadCustomers() {
    const select = document.getElementById("customerSelect");

    select.innerHTML = "";

    Object.entries(inventoryData.all.hosts).forEach(([host, data]) => {
        const nameFa = data.vars.customer_name;
        const opt = document.createElement("option");
        opt.value = host;
        opt.innerText = nameFa;
        select.appendChild(opt);
    });
}

/*************************
 * Tabs Renderer
 *************************/
function renderTabs(vars) {
    const modules = {};
    const domain = {};
    const backup = {};
    const test = {};
    const database = {};

    Object.entries(vars).forEach(([key, value]) => {

        if (key === "customer_domain" || key === "customer_url" || key.startsWith("customer_subdomain_")) {
            domain[key] = value;
        }
        else if (key.startsWith("customer_backup_")) {
            backup[key] = value;
        }
        else if (key.startsWith("customer_test_")) {
            test[key] = value;
        }
        else if (key.includes("_mysql_")) {
            const service = key.split("_mysql_")[0];
            database[service] ??= {};
            database[service][key] = value;
        }
        else if (key.startsWith("customer_") && !key.includes("subdomain") && key !== "customer_state") {
            let service = key.replace("customer_", "").split("_git")[0].split("_update")[0];

            if (!modulesList.includes(service)) return;
            modules[service] ??= {};
            modules[service][key] = value;
        }
    });

    // رندر هر بخش با ترتیب Switch → Text → Cron
    renderSection("modules", modules, true);
    renderSection("domain", domain);
    renderSection("backup", backup);
    renderSection("test", test);
    renderSection("database", database, true);
}

/*************************
 * Inputs Renderer (ترتیب Switch → Text → Cron)
 *************************/
function renderInputs(items) {
    const entries = Object.entries(items);

    // Boolean اول
    const booleans = entries.filter(([key, value]) => typeof value === "boolean");
    // Cron آخر
    const crons = entries.filter(([key, value]) => key.includes("cron_"));
    // بقیه متون
    const texts = entries.filter(([key, value]) => typeof value !== "boolean" && !key.includes("cron_"));

    return [
        ...booleans.map(([k, v]) => renderInput(k, v)),
        ...texts.map(([k, v]) => renderInput(k, v)),
        ...crons.map(([k, v]) => renderInput(k, v))
    ].join("");
}

/*************************
 * Section Renderer
 *************************/
function renderSection(targetId, data, grouped = false) {
    const container = document.getElementById(targetId);
    container.innerHTML = "";

    if (grouped) {
        Object.entries(data).forEach(([group, items]) => {
            container.innerHTML += `
                <h4 class="mt-3 p-2 text-end bg-light rounded border border-secondary text-capitalize">${group}</h4>
                ${renderInputs(items)}
            `;
        });
    } else {
        container.innerHTML = renderInputs(data);
    }
}

/*************************
 * Input Renderer
 *************************/
function renderInput(key, value) {

    if (typeof value === "boolean") {
        return renderBooleanSwitch(key, value);
    }

    if (key.includes("cron_")) {
        return renderCron(key, value);
    }

    let extraValidation = "";

    if (key === "customer_domain") {
        extraValidation = `onblur="if(!isValidDomain(this.value)) alert('دامنه نامعتبر است')"`
    }

    if (key === "customer_url") {
        extraValidation = `onblur="if(!isValidIP(this.value)) alert('IP نامعتبر است')"`
    }

    return `
        <div class="mb-2 d-flex align-items-center gap-2">
            <label class="form-label mb-0">${labelsFa[key] ?? key}</label>
            <input class="form-control"
                   value="${value}"
                   oninput="if(!isEnglish(this.value)) this.value=this.value.replace(/[^\x00-\x7F]/g,'')"
                   ${extraValidation}>
        </div>
    `;
}

/*************************
 * Boolean → Bootstrap Switch
 *************************/
function renderBooleanSwitch(name, value) {
    const id = `switch_${name}`;

    return `
        <div class="form-check form-switch mb-3 d-flex align-items-center gap-2">
            <input class="form-check-input"
                   type="checkbox"
                   id="${id}"
                   ${value ? "checked" : ""}>
            <label class="form-check-label" for="${id}">
                ${labelsFa[name] ?? name}
            </label>
        </div>
    `;
}

/*************************
 * Cron UI
 *************************/
function renderCron(name, value) {
    const parts = value.split(" ");

    return `
        <hr>
        <div class="mb-3">
            <label class="form-label">${labelsFa[name] ?? name}</label>
            <div class="row d-block">
                <div class="col mt-1"><div class="w-100 ">دقیقه: </div><input class="form-control" value="${parts[0] || "*"}" placeholder="دقیقه"></div>
                <div class="col mt-1"><div class="w-100 ">ساعت: </div><input class="form-control" value="${parts[1] || "*"}" placeholder="ساعت"></div>
                <div class="col mt-1"><div class="w-100 ">روز: </div><input class="form-control" value="${parts[2] || "*"}" placeholder="روز"></div>
                <div class="col mt-1"><div class="w-100 ">روز هفته: </div><input class="form-control" value="${parts[4] || "*"}" placeholder="روز هفته"></div>
            </div>
        </div>
    `;
}

/*************************
 * Run Playbook
 *************************/
function runPlaybook() {
    const customer = document.getElementById("customerSelect").value;

    fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer })
    })
        .then(res => res.json())
        .then(() => {
            document.getElementById("result").innerText =
                "اجرای playbook آغاز شد";
        });
}

/*************************
 * Save Customer Vars
 *************************/
function saveCustomerVars() {
    const customer = document.getElementById("customerSelect").value;

    const mergedVars = getCustomerVars(customer);
    const inputs = document.querySelectorAll("#modules input, #domain input, #backup input, #test input, #database input");

    const newVars = {};

    inputs.forEach(input => {
        const key = input.previousElementSibling?.innerText || input.name;
        let value = input.type === "checkbox" ? input.checked : input.value;
        newVars[key] = value;
    });

    fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, vars: newVars })
    })
        .then(res => res.json())
        .then(() => {
            document.getElementById("result").innerText =
                "تغییرات ذخیره شد";
        });
}

/*************************
 * Down Customer 
 *************************/
function downCustomer() {
    const customer = document.getElementById("customerSelect").value;

    fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            customer,
            extra_vars: { customer_state: "down" } // ← اضافه شدن متغیر extra
        })
    })
        .then(res => res.json())
        .then(() => {
            document.getElementById("result").innerText =
                `اجرای playbook برای ${customer} با customer_state=down آغاز شد`;
        });
}

/*************************
// دپلوی + تست کامل
 *************************/
function testFull() {
    const customer = document.getElementById("customerSelect").value;

    fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            customer,
            extra_vars: { customer_test_enabled: true }
        })
    })
        .then(res => res.json())
        .then(() => {
            document.getElementById("result").innerText =
                `تست کامل + دپلوی برای ${customer} آغاز شد`;
        });
}

/*************************
// فقط تست (بدون دپلوی مجدد)
 *************************/
function testOnly() {
    const customer = document.getElementById("customerSelect").value;

    fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            customer,
            extra_vars: { customer_test_enabled: true },
            tags: "test"  // فقط اجرا با تگ test
        })
    })
        .then(res => res.json())
        .then(() => {
            document.getElementById("result").innerText =
                `اجرای تست فقط برای ${customer} آغاز شد`;
        });
}

/*************************
// دپلوی + تست کامل + fail-fast
 *************************/
function testFailFast() {
    const customer = document.getElementById("customerSelect").value;

    fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            customer,
            extra_vars: {
                customer_test_enabled: true,
                customer_test_fail_fast: true
            }
        })
    })
        .then(res => res.json())
        .then(() => {
            document.getElementById("result").innerText =
                `دپلوی + تست کامل + fail-fast برای ${customer} آغاز شد`;
        });
}

/*************************
// تهیه نسخه بکاپ
 *************************/
function backupCustomer() {
    const customer = document.getElementById("customerSelect").value;

    fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            customer,
            tags: "backup"  // ← فقط تگ backup
        })
    })
        .then(res => res.json())
        .then(() => {
            document.getElementById("result").innerText =
                `اجرای بکاپ برای ${customer} آغاز شد`;
        });
}

/*************************
// اجرای پلی بوک
 *************************/
function runPlaybook() {
    const customer = document.getElementById("customerSelect").value;
    const vars = getCustomerVars(customer);

    const activeUpdates = {};

    modulesList.forEach(mod => {
        const key = `customer_${mod}_update`;
        if (vars[key]) {
            activeUpdates[key] = true;
        }
    });

    // اگر همه true باشند، extra_vars خالی است
    const extraVars = Object.keys(activeUpdates).length === modulesList.length ? {} : activeUpdates;

    fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            customer,
            extra_vars: extraVars
        })
    })
        .then(res => res.json())
        .then(() => {
            if (Object.keys(extraVars).length === 0) {
                document.getElementById("result").innerText =
                    `بروزرسانی کامل برای ${customer} آغاز شد`;
            } else {
                document.getElementById("result").innerText =
                    `بروزرسانی ماژول‌های فعال برای ${customer} آغاز شد: ${Object.keys(extraVars).join(", ")}`;
            }
        });
}
