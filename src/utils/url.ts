import { forwardProxy } from "@/api";
import { Readability } from "@mozilla/readability";

export const getUrlContent = async (href) => {
    console.log(href);

    if (!href.startsWith("http")) href = "http://" + href;

    let data = await forwardProxy(
        href, 'GET', null,
        [{ 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.76" }],
        5000, 'text/html'
    );

    if (!data || (data.status / 100) !== 2)
        return { urlTitle: null, urlContent: null };

    const doc = new DOMParser().parseFromString(data?.body, "text/html");

    doc.head.appendChild(Object.assign(doc.createElement("base"), { href: href }));

    const readableHTML = new Readability(doc).parse();
    let urlTitle = null;

    if (doc.characterSet.toLowerCase() === "utf-8")
        urlTitle = doc.title;

    const urlContent = readableHTML?.content;

    return { urlTitle, urlContent };
}
