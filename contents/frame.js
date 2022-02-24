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
    const THIS_URL = new URL(location.href);

    var Path = DevOpsMarked.Path;


    class AttachmentLoaderProxy {
        constructor() {
            this._configData = {};
        }

        static onMessagePromiseId = 0;
        static onMessagePromises = {};

        static async initialize() {
            let loader = new AttachmentLoaderProxy();
            await loader.loadConfigData();
            return loader;
        }

        static onMessageHandler(data) {
            let promises = this.onMessagePromises;
            if (!promises.hasOwnProperty(data.id)) {
                console.error(`Unknown id: ${data.id}`);
                return;
            }

            if (data.result) {
                promises[data.id].resolve(data.data);
            } else {
                promises[data.id].reject(data.data);
            }
            delete promises[data.id];
        }

        static sendMessage(type, data) {
            this.onMessagePromiseId = (this.onMessagePromiseId + 1) % 0x40000000;
            const id = `${new Date().getTime()}_${this.onMessagePromiseId}`;
            window.parent.postMessage({ id: id, type: type, data: data }, THIS_URL.origin);
            return new Promise((resolve, reject) => {
                this.onMessagePromises[id] = {
                    "resolve": resolve,
                    "reject": reject
                };
            });
        }

        async loadConfigData() {
            this._configData = await AttachmentLoaderProxy.sendMessage("config", null);
        }

        configData() {
            return this._configData;
        }

        async loadContentBlob(name, type) {
            const buffer = await AttachmentLoaderProxy.sendMessage("content", { name: name });
            if (!buffer) {
                return buffer;
            }
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

        const imageBlob = await loader.loadContentBlob(filePath.logPath(), IMAGE_TYPES[imageExtension]);
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

    var onLoadAsync = async function () {
        const outputElement = document.querySelector("#publish-markdown-reports-output");
        try {
            const loader = await AttachmentLoaderProxy.initialize();
            const configData = loader.configData() || {};

            const currentUrl = THIS_URL;
            const path = extractPath(currentUrl, configData);
            const attachmentBlob = await loader.loadContentBlob(path.logPath(), "text/plain");
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

    window.addEventListener("message", function (event) {
        try {
            const expectedOrigin = THIS_URL.origin;
            if (event.origin != expectedOrigin) {
                // Just ignore to prevent security issue.
                return;
            }

            AttachmentLoaderProxy.onMessageHandler(event.data);
        } catch (e) {
            console.error(e);
        }
    });
    document.addEventListener("DOMContentLoaded", function () {
        onLoadAsync();
    });
})();
