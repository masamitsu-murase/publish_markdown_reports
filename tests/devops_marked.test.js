const fs = require('fs');
const path = require('path');
const DevOpsMarked = require('./devops_marked');


function replaceAll(text, pattern, replacement) {
    if (pattern instanceof RegExp) {
        return text.replace(pattern, replacement);
    } else if (typeof pattern == "string") {
        return text.split(pattern).join(replacement);
    } else {
        throw new Error("pattern must be string");
    }
}
if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (pattern, replacement) {
        return replaceAll(this, pattern, replacement);
    };
}

describe('Path', () => {
    const Path = DevOpsMarked.Path;

    test("fromUrl", () => {
        const fromUrl = Path.fromUrl("/md/dir 1/index space.md");
        expect(fromUrl.path).toEqual(["md", "dir 1", "index space.md"]);
    });

    test("fromUrlWithoutSlash", () => {
        const fromUrl = Path.fromUrlWithoutSlash("md/dir 1/index space.md");
        expect(fromUrl.path).toEqual(["md", "dir 1", "index space.md"]);
    });

    test("fromMarkdownRelative", () => {
        const baseDir = Path.fromMarkdownAbsolute("/dir 2");
        const fromMd0 = Path.fromMarkdownRelative("./dir1/index space.md", baseDir);
        expect(fromMd0.path).toEqual(["md", "dir 2", "dir1", "index space.md"]);
        const fromMd1 = Path.fromMarkdownRelative("../index space.md", baseDir);
        expect(fromMd1.path).toEqual(["md", "index space.md"]);
    });

    test("fromMarkdownAbsolute", () => {
        const fromMd0 = Path.fromMarkdownAbsolute("/dir1/dir2/index.md");
        expect(fromMd0.path).toEqual(["md", "dir1", "dir2", "index.md"]);
        const fromMd1 = Path.fromMarkdownAbsolute("/dir1/../dir2/index.md");
        expect(fromMd1.path).toEqual(["md", "dir2", "index.md"]);
    });

    test("fromLog", () => {
        const fromLog = Path.fromLog("md^08dir^091^08index.md");
        expect(fromLog.path).toEqual(["md", "dir 1", "index.md"]);
    });

    test("several methods", () => {
        const filepath = new Path(["md", "dir 1", "index.markdown"], "raw");
        expect(filepath.extension()).toBe("markdown");
        expect(filepath.isRoot()).toBeFalsy();
        expect(filepath.markdownPath()).toBe("/dir 1/index.markdown");
        expect(filepath.logPath()).toBe("md^08dir^091^08index.markdown");
        expect(filepath.urlPath()).toBe("/md/dir 1/index.markdown");
        expect(filepath.urlPathWithoutSlash()).toBe("md/dir 1/index.markdown");

        const dir1 = filepath.parent();
        expect(dir1.path).toEqual(["md", "dir 1"]);
        expect(dir1.extension()).toBeNull();
        expect(dir1.isRoot()).toBeFalsy();
        expect(dir1.markdownPath()).toBe("/dir 1");
        expect(dir1.logPath()).toBe("md^08dir^091");
        expect(dir1.urlPath()).toBe("/md/dir 1");
        expect(dir1.urlPathWithoutSlash()).toBe("md/dir 1");

        const root = dir1.parent();
        expect(root.path).toEqual(["md"]);
        expect(root.extension()).toBeNull();
        expect(root.isRoot()).toBeTruthy();
        expect(root.markdownPath()).toBe("/");
        expect(root.logPath()).toBe("md");
        expect(root.urlPath()).toBe("/md");
        expect(root.urlPathWithoutSlash()).toBe("md");

        expect(() => root.parent()).toThrow(Error);
    });
});

describe('Markdown', () => {
    test('Conversion', () => {
        const markdownText = fs.readFileSync(path.resolve(__dirname, "contents", "index.md")).toString();
        const currentFilepath = DevOpsMarked.Path.fromMarkdownAbsolute("/dir 1/index.md")

        const expectedImageIds = [
            { href: 'md/dir 1/images/screenshot.png', id: 'publishmarkdownreports_image_0' },
            { href: 'md/images/screenshot2.png', id: 'publishmarkdownreports_image_1' },
            { href: 'md/images/screenshot3.png', id: 'publishmarkdownreports_image_2' },
        ];
        const headingIds = [
            "none",
            "pythonmarkdown",
            "doxybook2",
        ];

        const spy = jest.spyOn(global.console, 'warn');
        spy.mockImplementation(() => undefined);

        const headingId = "none";
        const [htmlText, imageIds] = DevOpsMarked.createMarkdownReport(markdownText, currentFilepath, headingId, false);
        // fs.writeFileSync(path.resolve(__dirname, "contents", `index_${headingId}_nokatex.html`), htmlText);
        expect(imageIds).toEqual(expectedImageIds);
        const expectedHtmlText = fs.readFileSync(path.resolve(__dirname, "contents", `index_${headingId}_nokatex.html`)).toString();
        expect(htmlText).toEqual(expectedHtmlText);

        headingIds.forEach(headingId => {
            const [htmlText, imageIds] = DevOpsMarked.createMarkdownReport(markdownText, currentFilepath, headingId, true);
            // fs.writeFileSync(path.resolve(__dirname, "contents", `index_${headingId}_katex.html`), htmlText);
            expect(imageIds).toEqual(expectedImageIds);
            const expectedHtmlText = fs.readFileSync(path.resolve(__dirname, "contents", `index_${headingId}_katex.html`)).toString();
            expect(htmlText).toEqual(expectedHtmlText);
        });
    });
});
