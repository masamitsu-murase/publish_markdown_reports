var DevOpsMarked = (function () {
    const ROOT_PATH_PREFIX = "md";
    const PATH_PARAM_NAME = "path";
    const LOG_ESCAPE_CHARACTER = "^";

    class Path {
        static ESCAPED_CHARACTERS = '<>|:*?\\/ ';

        static escapeLog(path) {
            const chars = LOG_ESCAPE_CHARACTER + this.ESCAPED_CHARACTERS;
            for (let i = 0; i < chars.length; i++) {
                const num = `${i}`.padStart(2, "0");
                path = path.replaceAll(chars[i], `${LOG_ESCAPE_CHARACTER}${num}`);
            }
            return path;
        }

        static unescapeLog(path) {
            const chars = this.ESCAPED_CHARACTERS;
            for (let i = 0; i < chars.length; i++) {
                const num = `${i + 1}`.padStart(2, "0");
                path = path.replaceAll(`${LOG_ESCAPE_CHARACTER}${num}`, chars[i]);
            }
            path = path.replaceAll(`${LOG_ESCAPE_CHARACTER}00`, LOG_ESCAPE_CHARACTER);
            return path;
        }

        static fromUrl(url) {
            return new Path(url, "url");
        }

        static fromUrlWithoutSlash(url) {
            return new Path("/" + url, "url");
        }

        static fromMarkdownRelative(path, baseDir) {
            if (baseDir.isRoot()) {
                return new Path("/" + path, "markdown");
            } else {
                return new Path(baseDir.markdownPath() + "/" + path, "markdown");
            }
        }

        static fromMarkdownAbsolute(path) {
            return new Path(path, "markdown");
        }

        static fromLog(path) {
            return new Path(path, "log");
        }

        static normalize(pathItems) {
            let result = [];
            pathItems.forEach(item => {
                switch (item) {
                    case ".":
                        break;
                    case "..":
                        if (result.length == 0) {
                            throw new Error("Invalid path");
                        }
                        result.pop();
                        break;
                    default:
                        result.push(item);
                        break;
                }
            })
            return result;
        }

        constructor(path, type) {
            switch (type) {
                case "url":
                    // e.g. /md/dir/sample.md
                    path = path.slice(1).split("/");
                    break;
                case "markdown":
                    // Split, then add ROOT_PATH_PREFIX.
                    // e.g. /dir/sample.md
                    path = [ROOT_PATH_PREFIX].concat(path.slice(1).split("/"));
                    break;
                case "log":
                    // Unescape with LOG_ESCAPE_CHARACTER.
                    // e.g. md^08dir^08sample.md
                    path = Path.unescapeLog(path).split("/");
                    break;
                case "raw":
                    break;
                default:
                    throw new Error(`Unknown type: ${type}`);
            }
            // path is ["md", "dir", "sample.md"]
            this.path = Path.normalize(path);
        }

        extension() {
            return this.path[this.path.length - 1].split(".").pop();
        }

        isRoot() {
            return this.path.length == 1;
        }

        parent() {
            if (this.isRoot()) {
                throw new Error("Root directory does not have a parent.");
            }

            return new Path(this.path.slice(0, -1), "raw");
        }

        markdownPath() {
            return "/" + this.path.slice(1).join("/");
        }

        logPath() {
            return Path.escapeLog(this.path.join("/"));
        }

        urlPath() {
            return "/" + this.path.join("/");
        }

        urlPathWithoutSlash() {
            return this.path.join("/");
        }
    }

    var mySlug = function (originalSlug, options) {
        // Note that Slugger has this.seen.
        let slug = originalSlug;
        let occurenceAccumulator = 0;
        if (this.seen.hasOwnProperty(slug)) {
            occurenceAccumulator = this.seen[originalSlug];
            do {
                occurenceAccumulator++;
                slug = originalSlug + '_' + occurenceAccumulator;
            } while (this.seen.hasOwnProperty(slug));
        }
        this.seen[originalSlug] = occurenceAccumulator;
        this.seen[slug] = 0;
        return slug;
    };
    marked.Slugger.prototype.slug = mySlug;

    const rendererNone = {
        heading: function (text, level, raw, slugger) {
            return `<h${level}>${text}</h${level}>\n`;
        }
    };

    const rendererDoxybook2 = {
        heading: function (text, level, raw, slugger) {
            const id = raw.toLowerCase()
                .trim()
                .replaceAll("::", "")
                .replaceAll(" ", "-")
                .replaceAll("_", "-")
                // remove unwanted chars
                .replaceAll(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '');
            return '<h' + level + ' id="' + slugger.slug(id) + '">' + text + '</h' + level + '>\n';
        }
    };

    const rendererPythonMarkdown = {
        heading: function (text, level, raw, slugger) {
            const separator = "-";
            const escaped = raw.normalize("NFKD")
                .replaceAll(/[^\x00-\x7F]/g, "")
                .replaceAll(/[^\w\s-]/g, "")
                .trim()
                .toLowerCase()
                .replaceAll(new RegExp(`[${separator}\\s]+`, "g"), separator);
            const id = slugger.slug(escaped);
            return '<h' + level + ' id="' + id + '">' + text + '</h' + level + '>\n';
        }
    };

    var InternalLinkRenderer = class extends marked.Renderer {
        constructor(currentFilePath) {
            super();
            this.currentFilePath = currentFilePath;
            this.imageIds = [];
        }

        isExternalLink(url) {
            const absoluteUrlPattern = /^([a-z][a-z0-9+.-]*:)?\/\//;
            return absoluteUrlPattern.test(url);
        }

        convertInternalLink(href) {
            if (href == null) {
                return href;
            }

            if (this.isExternalLink(href)) {
                return href;
            }

            const currentDirPath = this.currentFilePath.parent();
            switch (href.charAt(0)) {
                case "/":
                    href = Path.fromMarkdownAbsolute(href).urlPathWithoutSlash();
                    break;
                case "#":
                    href = this.currentFilePath.urlPathWithoutSlash() + href;
                    break;
                case "?":
                    break;
                default:
                    href = Path.fromMarkdownRelative(href, currentDirPath).urlPathWithoutSlash();
                    break;
            }
            return href;
        }

        link(href, title, text) {
            href = this.convertInternalLink(href);
            return super.link(href, title, text);
        }

        image(href, title, text) {
            if (!href || this.isExternalLink(href)) {
                return super.image(href, title, text);
            }

            const id = "publishmarkdownreports_image_" + this.imageIds.length;
            const imageInfo = {
                href: this.convertInternalLink(href),
                id: id
            };
            this.imageIds.push(imageInfo);
            return `<img alt="${text}" id="${id}"` + (title ? ` title="${title}"` : '') + (this.options.xhtml ? '/>' : '>');
        }
    };

    var createMarkdownReport = function (text, currentFilePath, headerIdType) {
        const renderer = new InternalLinkRenderer(currentFilePath);
        const options = {
            baseUrl: `?${PATH_PARAM_NAME}=/`,
            breaks: true,
            gfm: true,
            highlight: function (code, lang) {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            },
            langPrefix: "hljs language-",
            renderer: renderer
        };

        switch ((headerIdType || "").toLowerCase()) {
            case "doxybook2":
                marked.use({ renderer: rendererDoxybook2 });
                break;
            case "pythonmarkdown":
                marked.use({ renderer: rendererPythonMarkdown });
                break;
            case "marked":
                break;
            case "none":
            default:
                marked.use({ renderer: rendererNone });
                break;
        }

        const md = marked.parse(text, options);
        const html = DOMPurify.sanitize(md, { USE_PROFILES: { html: true } });

        return [html, renderer.imageIds];
    };

    return {
        Path: Path,
        createMarkdownReport: createMarkdownReport,
    }
})();
