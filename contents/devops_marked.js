var DevOpsMarked = (function () {
    const ROOT_PATH_PREFIX = "md";
    const PATH_PARAM_NAME = "path";
    const LOG_ESCAPE_CHARACTER = "^";

    class Path {
        //                           123456 789
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
            const splitted = this.path[this.path.length - 1].split(".");
            if (splitted.length <= 1) {
                return null;
            }
            return splitted[splitted.length - 1];
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

    var InternalLinkRenderer = class extends marked.Renderer {
        constructor(currentFilePath, headingId) {
            super();
            this.currentFilePath = currentFilePath;
            this.imageIds = [];
            this.headingId = (headingId || "").toLowerCase();
        }

        isExternalLink(url) {
            const absoluteUrlPattern = /^([a-z][a-z0-9+.-]*:)?\/\//;
            return absoluteUrlPattern.test(url);
        }

        convertInternalLink(href) {
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

        headingPythonMarkdown(text, level, raw, slugger) {
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

        headingDoxybook2(text, level, raw, slugger) {
            const id = raw.toLowerCase()
                .trim()
                .replaceAll("::", "")
                .replaceAll(" ", "-")
                .replaceAll("_", "-")
                // remove unwanted chars
                .replaceAll(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '');
            return '<h' + level + ' id="' + slugger.slug(id) + '">' + text + '</h' + level + '>\n';
        }

        headingNone(text, level, raw, slugger) {
            return `<h${level}>${text}</h${level}>\n`;
        }

        heading(text, level, raw, slugger) {
            switch(this.headingId) {
                case "pythonmarkdown":
                    return this.headingPythonMarkdown(text, level, raw, slugger);
                case "doxybook2":
                    return this.headingDoxybook2(text, level, raw, slugger);
                case "none":
                default:
                    return this.headingNone(text, level, raw, slugger);
            }
        }

        link(href, title, text) {
            if (!href || this.isExternalLink(href)) {
                let tag = super.link(href, title, text);
                // tag is '<a href=...>text</a>' or text itself.
                if (tag !== text) {
                    tag = '<a target="_top" rel="noreferrer"' + tag.slice(2);
                }
                return tag;
            }

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

    var KatexEnabledFlag = true;
    const KatexDefaultOptions = {
        throwOnError: false,
        output: "htmlAndMathml",
    }

    var KatexInlineExtension = {
        name: "KatexInline",
        level:  "inline",

        start(src) {
            if (!KatexEnabledFlag) {
                return -1;
            }

            // See https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Regular_expressions/Assertions
            // Match: $abc = def$
            // Don't match: $abc = def $, $ abc = def$
            const pattern = /((^\$)|([^\\$](\\\\)*\$))(?!\t| )([^\n$]|(?<!\\)(\\\\)*\\\$)+?(?<!\\)(\\\\)*(?<!\t| )\$((?!\$)|$)/;
            const matchedData = src.match(pattern);
            if (!matchedData) {
                return -1;
            }

            const index = matchedData.index;
            const matchedStr = matchedData[0];
            return index + matchedStr.indexOf("$");
        },

        tokenizer(src, tokens) {
            const pattern = /^\$(?!\t| )([^\n$]|(?<!\\)(\\\\)*\\\$)+?(?<!\\)(\\\\)*(?<!\t| )\$((?!\$)|$)/;
            const matchedData = src.match(pattern);
            if (!matchedData) {
                return;
            }
            const matchedStr = matchedData[0];
            return {
                type: "KatexInline",
                raw: matchedStr,
                text: matchedStr.slice(1, -1),
            }
        },

        renderer(token) {
            const options = Object.assign({}, KatexDefaultOptions, {
                displayMode: false,
            });
            return katex.renderToString(token.text, options);
        },
    };

    var KatexBlock2DollarExtension = {
        name: "KatexBlock2Dollar",
        level: "block",

        start(src) {
            if (!KatexEnabledFlag) {
                return -1;
            }

            // Match: $$abc = def$$
            //        $$
            //        \begin{array}{rcl}
            //        a &=& \int_0^\infty x dx\\
            //          &=& \int_0^\infty y dy
            //        \end{array}
            //        $$
            // Don't match: $$abc = def $$, $$ abc = def$$
            const pattern = /((^\$\$)|([^\\$](\\\\)*\$\$))(?!\t| )([^$]|(?<!\$)\$|(?<!\\)(\\\\)*\\\$\$)+?(?<!\\)(\\\\)*(?<!\t| )\$\$((?!\$)|$)/;
            const matchedData = src.match(pattern);

            if (!matchedData) {
                return -1;
            }
            return matchedData.index + matchedData[0].indexOf("$");
        },

        tokenizer(src, tokens) {
            const pattern = /^\$\$(?!\t| )([^$]|(?<!\$)\$|(?<!\\)(\\\\)*\\\$\$)+?(?<!\\)(\\\\)*(?<!\t| )\$\$((?!\$)|$)/;
            const matchedData = src.match(pattern);

            if (!matchedData) {
                return;
            }

            return {
                type: "KatexBlock2Dollar",
                raw: matchedData[0],
                text: matchedData[0].slice(2, -2),
            };
        },

        renderer(token) {
            const options = Object.assign({}, KatexDefaultOptions, {
                displayMode: true,
            });
            return katex.renderToString(token.text, options);
        },
    };

    var KatexBlock1DollarExtension = {
        name: "KatexBlock1Dollar",
        level: "block",

        start(src) {
            if (!KatexEnabledFlag) {
                return -1;
            }

            // Match: $
            //        \begin{array}{rcl}
            //        a &=& \int_0^\infty x dx\\
            //          &=& \int_0^\infty y dy
            //        \end{array}
            //        $
            // Don't match:
            //        $
            //        \begin{array}{rcl}
            //        a &=& \int_0^\infty x dx\\
            //          &=& \int_0^\infty y dy
            //        \end{array}
            //
            //        $
            const pattern = /((^\$)|([^\\$](\\\\)*\$))(?!\t| )([^\n$]|(?<!\\)(\\\\)*\\\$)*\n([^\n$]|(?<!\n)\n|(?<!\\)(\\\\)*\\\$)+?(?<!\\)(\\\\)*\$((?!\$)|$)/;
            const matchedData = src.match(pattern);

            if (!matchedData) {
                return -1;
            }

            return matchedData.index + matchedData[0].indexOf("$");
        },

        tokenizer(src, tokens) {
            const pattern = /^\$(?!\t| )([^\n$]|(?<!\\)(\\\\)*\\\$)*\n([^\n$]|(?<!\n)\n|(?<!\\)(\\\\)*\\\$)+?(?<!\\)(\\\\)*\$((?!\$)|$)/;
            const matchedData = src.match(pattern);

            if (!matchedData) {
                return;
            }

            return {
                type: "KatexBlock1Dollar",
                raw: matchedData[0],
                text: matchedData[0].slice(1, -1),
            };
        },

        renderer(token) {
            const options = Object.assign({}, KatexDefaultOptions, {
                displayMode: true,
            });
            return katex.renderToString(token.text, options);
        },
    };

    var createMarkdownReport = function (text, currentFilePath, headingId, katexEnabled) {
        const renderer = new InternalLinkRenderer(currentFilePath, headingId);
        const options = {
            baseUrl: `?${PATH_PARAM_NAME}=/`,
            breaks: true,
            gfm: true,
            highlight: function (code, lang) {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            },
            langPrefix: "hljs language-",
            renderer: renderer,
        };

        KatexEnabledFlag = katexEnabled;

        const html = marked.parse(text, options);

        return [html, renderer.imageIds];
    };

    marked.use({
        extensions: [
            KatexInlineExtension,
            KatexBlock2DollarExtension,
            KatexBlock1DollarExtension,
        ],
    });

    return {
        Path: Path,
        createMarkdownReport: createMarkdownReport,
    }
})();
