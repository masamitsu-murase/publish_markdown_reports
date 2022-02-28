(function () {
    const CONFIG_FILE_NAME = "config.json";
    const ATTACHMENT_TYPE = "publishmarkdownreports";
    const THIS_URL = new URL(location.href);

    var gInitializerPromise;


    class AttachmentLoader {
        constructor(taskClient, projectId, build) {
            this.taskClient = taskClient;
            this.projectId = projectId;
            this.planId = build.orchestrationPlan.planId;
            this._attachments = [];
            this._configData = {};
        }

        static async initialize(taskClient, projectId, build) {
            let loader = new AttachmentLoader(taskClient, projectId, build);
            await loader.loadAttachments();
            await loader.loadConfigData();
            return loader;
        }

        async loadAttachments() {
            this._attachments = await this.taskClient.getPlanAttachments(this.projectId, "build", this.planId, ATTACHMENT_TYPE);
        }

        async loadConfigData() {
            const configDataBlob = await this.loadContentBlob(CONFIG_FILE_NAME, "text/plain");
            this._configData = (configDataBlob ? JSON.parse(await configDataBlob.text()) : null);
        }

        configData() {
            return this._configData;
        }

        find(name) {
            return this._attachments.find(item => item.name == name);
        }

        has(name) {
            return this.find(name) !== undefined;
        }

        async loadAttachmentArrayBuffer(name) {
            const attachment = this.find(name);
            if (!attachment) {
                return null;
            }
            const buffer = await this.taskClient.getAttachmentContent(this.projectId, "build", this.planId,
                attachment.timelineId, attachment.recordId, ATTACHMENT_TYPE, attachment.name);
            return buffer;
        }

        async loadContentBlob(name, type) {
            const buffer = await this.loadAttachmentArrayBuffer(name);
            return new Blob([buffer], { type: type });
        }
    }

    var sendResponse = function(id, result, data, transfer) {
        const frame = document.getElementById("markdown_frame");
        const message = {
            id: id,
            result: result,
            data: data
        };
        frame.contentWindow.postMessage(message, THIS_URL.origin, transfer);
    };

    var sendAttachmentContent = async function (loader, id, path) {
        const attachmentArrayBuffer = await loader.loadAttachmentArrayBuffer(path);
        const transfer = attachmentArrayBuffer ? [attachmentArrayBuffer] : undefined;
        sendResponse(id, true, attachmentArrayBuffer, transfer);
    };

    var sendConfigData = async function (loader, id) {
        sendResponse(id, true, loader.configData(), undefined);
    };

    var onMessageHandlerAsync = async function (event) {
        try {
            const expectedOrigin = THIS_URL.origin;
            if (event.origin != expectedOrigin) {
                // Just ignore to prevent security issue.
                return;
            }

            const loader = await gInitializerPromise;
            const data = event.data;
            switch (data.type) {
                case "content":
                    await sendAttachmentContent(loader, data.id, data.data.name);
                    break;
                case "config":
                    await sendConfigData(loader, data.id);
                    break;
                default:
                    throw new Error(`Unknown type: ${data.type}`);
                    break;
            }
        } catch (e) {
            console.error(e);
            sendResponse(data.id, false, `${e}`, undefined);
        }
    };

    var onBuildChangedCallbackAsync = async function (vsoContext, taskClient, build, resolve, reject) {
        try {
            const loader = await AttachmentLoader.initialize(taskClient, vsoContext.project.id, build);
            resolve(loader);
        } catch (e) {
            console.error(e);
            reject(e);
        }
    };

    gInitializerPromise = new Promise((resolve, reject) => {
        window.addEventListener("message", function (event) {
            onMessageHandlerAsync(event);
        });

        VSS.init({ usePlatformStyles: false });
        VSS.ready(function () {
            const vsoContext = VSS.getWebContext();
            const config = VSS.getConfiguration();
            if (!vsoContext) {
                const message = "vsoContext is not valid.";
                console.error(message);
                reject(new Error(message));
                return;
            }
            if (!config) {
                const message = "config is not valid.";
                console.error(message);
                reject(new Error(message));
                return;
            }

            VSS.require(["TFS/DistributedTask/TaskRestClient"], function (taskRestClient) {
                config.onBuildChanged((build) => {
                    onBuildChangedCallbackAsync(vsoContext, taskRestClient.getClient(), build, resolve, reject);
                });
            });
        });
    });
})();
