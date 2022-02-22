(function () {
    const ROOT_PATH_PREFIX = "md";
    const DEFAULT_PATH_VALUE = "/" + ROOT_PATH_PREFIX + "/" + "index.md";
    const CONFIG_FILE_NAME = "config.json";
    const PATH_PARAM_NAME = "path";
    const ATTACHMENT_TYPE = "publishmarkdownreports";
    const IMAGE_TYPES = {
        "apng": "image/apng",
        "gif": "image/gif",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "svg": "image/svg+xml"
    };

    var Path = DevOpsMarked.Path;


    class AttachmentLoader {
        constructor(taskClient, projectId, build) {
            this.taskClient = taskClient;
            this.projectId = projectId;
            this.planId = build.orchestrationPlan.planId;
            this._attachments = [];
        }

        static async initialize(taskClient, projectId, build) {
            let loader = new AttachmentLoader(taskClient, projectId, build);
            await loader.loadAttachments();
            return loader;
        }

        async loadAttachments() {
            this._attachments = await this.taskClient.getPlanAttachments(this.projectId, "build", this.planId, ATTACHMENT_TYPE);
        }

        find(name) {
            return this._attachments.find(item => item.name == name);
        }

        has(name) {
            return this.find(name) !== undefined;
        }

        async contentBlob(name, type) {
            const attachment = this.find(name);
            if (!attachment) {
                return null;
            }
            const buffer = await this.taskClient.getAttachmentContent(this.projectId, "build", this.planId,
                attachment.timelineId, attachment.recordId, ATTACHMENT_TYPE, attachment.name);
            return new Blob([buffer], { type: type });
        }
    }

    var scrollToElement = function (elementSelector) {
        const elem = document.querySelector(elementSelector);
        if (elem) {
            elem.scrollIntoView(true);
            return;
        }

        const id = elementSelector.slice(1);  // Remove '#'.
        const aTag = document.querySelector(`a[name="${id}"]`);
        if (aTag) {
            aTag.scrollIntoView(true);
            return;
        }
    };

    var extractPath = function (url, configData) {
        if (url.searchParams.has(PATH_PARAM_NAME)) {
            return Path.fromUrl(url.searchParams.get(PATH_PARAM_NAME));
        }
        if (configData.index) {
            return Path.fromMarkdownAbsolute("/" + configData.index);
        }
        return Path.fromUrl(DEFAULT_PATH_VALUE);
    };

    var loadImageAsync = async function (imageId, loader) {
        const href = imageId.href;
        const id = imageId.id;
        const filePath = Path.fromUrlWithoutSlash(href);
        const imageExtension = filePath.extension().toLowerCase();
        if (!IMAGE_TYPES.hasOwnProperty(imageExtension)) {
            console.warn(`Unknown image type: ${imageExtension}`);
            return;
        }

        const imageBlob = await loader.contentBlob(filePath.logPath(), IMAGE_TYPES[imageExtension]);
        if (!imageBlob) {
            console.warn(`No image found: ${filePath.logPath()}`);
            return;
        }

        const url = URL.createObjectURL(imageBlob);
        let imageElement = document.querySelector(`#${id}`);
        if (imageElement) {
            imageElement.src = url;
        }
    };

    var onBuildChangedCallbackAsync = async function (vsoContext, taskClient, build) {
        const outputElement = document.querySelector("#publish-markdown-reports-output");
        try {
            const loader = await AttachmentLoader.initialize(taskClient, vsoContext.project.id, build);
            const configDataBlob = await loader.contentBlob(CONFIG_FILE_NAME, "text/plain");
            const configData = (configDataBlob ? JSON.parse(await configDataBlob.text()) : {});

            const currentUrl = new URL(document.location.href);
            const path = extractPath(currentUrl, configData);
            const attachmentBlob = await loader.contentBlob(path.logPath(), "text/plain");
            if (!attachmentBlob) {
                console.warn(`Invalid path: ${path.logPath()}`);
                outputElement.innerHTML = "Load error: file not found.";
                return;
            }

            const text = await attachmentBlob.text();
            const [html, imageIds] = DevOpsMarked.createMarkdownReport(text, path, configData.headerId);
            outputElement.innerHTML = html;

            const promises = imageIds.map(imageId => loadImageAsync(imageId, loader));
            await Promise.all(promises);

            if (currentUrl.hash) {
                scrollToElement(currentUrl.hash);
            }
        } catch (e) {
            console.error(e);
            outputElement.innerHTML = "Load error.";
        }
    };

    VSS.init({ usePlatformStyles: false });
    VSS.ready(function () {
        const vsoContext = VSS.getWebContext();
        const config = VSS.getConfiguration();
        if (!vsoContext || !config) {
            return;
        }

        VSS.require(["TFS/DistributedTask/TaskRestClient"], function (taskRestClient) {
            config.onBuildChanged((build) => {
                onBuildChangedCallbackAsync(vsoContext, taskRestClient.getClient(), build);
            });
        });
    });
})();
