const { createApp, ref, computed } = Vue;

createApp({
    delimiters: ['[[', ']]'],
    setup() {

        /***********************
         * Globals
         ***********************/
        const inventoryData = ref({});
        const selectedCustomer = ref(null);
        const activeTab = ref("modules");
        const resultText = ref("");

        const MODULES = ["gateway", "portal", "portal_frontend", "lms", "file"];

        /***********************
         * Fetch Inventory
         ***********************/
        fetch("/api/inventory")
            .then(res => res.json())
            .then(data => {
                inventoryData.value = data;
                selectedCustomer.value = Object.keys(data.all.hosts)[0];
            });

        /***********************
         * Computed
         ***********************/
        const customers = computed(() =>
            Object.entries(inventoryData.value.all?.hosts || {})
        );

        function getCustomerVars(customer) {
            const hostVars = inventoryData.value.all.hosts[customer]?.vars || {};
            const defaultVars = inventoryData.value.all.vars || {};
            return { ...defaultVars, ...hostVars };
        }

        const mergedVars = computed(() =>
            selectedCustomer.value
                ? getCustomerVars(selectedCustomer.value)
                : {}
        );

        const customerStateText = computed(() =>
            mergedVars.value.customer_state === "up" ? "فعال" : "غیرفعال"
        );

        /***********************
         * Tabs Data Builder
         ***********************/
        const sections = computed(() => {
            const modules = {};
            const domain = {};
            const backup = {};
            const test = {};
            const database = {};

            Object.entries(mergedVars.value).forEach(([key, value]) => {

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
                    const svc = key.split("_mysql_")[0];
                    database[svc] ??= {};
                    database[svc][key] = value;
                }
                else if (key.startsWith("customer_") && key !== "customer_state") {
                    const svc = key
                        .replace("customer_", "")
                        .split("_update")[0]
                        .split("_git")[0];

                    if (!MODULES.includes(svc)) return;

                    modules[svc] ??= {};
                    modules[svc][key] = value;
                }
            });

            return { modules, domain, backup, test, database };
        });

        /***********************
         * Helpers
         ***********************/
        function orderedInputs(items) {
            const entries = Object.entries(items);
            const booleans = entries.filter(e => typeof e[1] === "boolean");
            const crons = entries.filter(e => e[0].includes("cron_"));
            const texts = entries.filter(e => typeof e[1] !== "boolean" && !e[0].includes("cron_"));
            return [...booleans, ...texts, ...crons];
        }

        function isBooleanKey(key) {
            return key.endsWith("_enabled") || key.endsWith("_update") || key.endsWith("_fail_fast");
        }

        /***********************
         * API Runner
         ***********************/
        function runApi(payload, message) {
            fetch("/api/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).then(() => {
                resultText.value = message;
            });
        }

        /***********************
         * Actions
         ***********************/
        function downCustomer() {
            runApi(
                { customer: selectedCustomer.value, extra_vars: { customer_state: "down" } },
                "داون کردن مشتری آغاز شد"
            );
        }

        function backupCustomer() {
            runApi(
                { customer: selectedCustomer.value, tags: "backup" },
                "بکاپ آغاز شد"
            );
        }

        function testFull() {
            runApi(
                { customer: selectedCustomer.value, extra_vars: { customer_test_enabled: true } },
                "تست کامل + دپلوی آغاز شد"
            );
        }

        function testOnly() {
            runApi(
                {
                    customer: selectedCustomer.value,
                    extra_vars: { customer_test_enabled: true },
                    tags: "test"
                },
                "فقط تست آغاز شد"
            );
        }

        function testFailFast() {
            runApi(
                {
                    customer: selectedCustomer.value,
                    extra_vars: {
                        customer_test_enabled: true,
                        customer_test_fail_fast: true
                    }
                },
                "تست کامل با توقف در خطای اول آغاز شد"
            );
        }

        function updateCustomer() {
            const active = {};
            MODULES.forEach(m => {
                const k = `customer_${m}_update`;
                if (mergedVars.value[k]) active[k] = true;
            });

            runApi(
                {
                    customer: selectedCustomer.value,
                    extra_vars: Object.keys(active).length === MODULES.length ? {} : active
                },
                "بروزرسانی آغاز شد"
            );
        }

        function saveCustomerVars() {
            fetch("/api/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customer: selectedCustomer.value,
                    vars: mergedVars.value
                })
            }).then(() => {
                resultText.value = "تغییرات ذخیره شد";
            });
        }

        /***********************
         * Expose to Template
         ***********************/
        return {
            labelsFa,
            customers,
            selectedCustomer,
            activeTab,
            sections,
            orderedInputs,
            isBooleanKey,
            customerStateText,
            resultText,

            updateCustomer,
            downCustomer,
            backupCustomer,
            testFull,
            testFailFast,
            testOnly,
            saveCustomerVars
        };
    }
}).mount("#app");
