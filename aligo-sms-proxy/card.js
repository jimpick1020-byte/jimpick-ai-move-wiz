import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const art = (name) => fileURLToPath(new URL(`./art/${name}`, import.meta.url));
const variants = {
  quote: { image: "sms-quote-illustration.jpg", title: "이사 견적서가 도착했어요", button: "견적서 확인하기", amount: "견적금액" },
  deposit: { image: "sms-deposit-illustration.jpg", title: "예약금 안내", button: "입금 및 예약 확인하기", amount: "예약금" },
  reminder: { image: "sms-reminder-illustration.jpg", title: "내일은 이사하는 날입니다", button: "이사 일정 확인하기", amount: "" },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const fit = (s, max) => {
  const v = String(s ?? "").trim();
  if (!v || v.length > max || /[\r\n\t]/.test(v)) throw new Error("문자 이미지에 넣을 자료가 올바르지 않습니다.");
  return esc(v);
};

/** Render only non-sensitive fields. The secure URL stays in the SMS body, never in the image. */
export async function renderCard(type, data) {
  const variant = variants[type];
  if (!variant) throw new Error("지원하지 않는 문자 이미지 종류입니다.");
  const company = fit(data.companyName, 36);
  const customer = fit(data.customerName, 24);
  const date = fit(data.moveDate, 30);
  const phone = fit(data.companyPhone, 30);
  if (!company || !customer || !date || !phone) throw new Error("업체 정보 또는 고객 자료가 부족해 그림문자를 보내지 않았습니다.");
  const amount = type === "reminder" ? "" : fit(data.amount, 24);
  if (type !== "reminder" && !amount) throw new Error("견적금액 또는 예약금이 없어 그림문자를 보내지 않았습니다.");
  const base = await readFile(art(variant.image));
  const background = `data:image/jpeg;base64,${base.toString("base64")}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640">
    <image href="${background}" width="1200" height="640"/>
    <text x="72" y="78" fill="#1762d6" font-family="Noto Sans KR" font-size="28" font-weight="700" ${company.length > 17 ? 'textLength="460" lengthAdjust="spacingAndGlyphs"' : ""}>${company}</text>
    <text x="72" y="162" fill="#132c50" font-family="Noto Sans KR" font-size="43" font-weight="700">${variant.title}</text>
    <text x="72" y="229" fill="#465976" font-family="Noto Sans CJK KR" font-size="30">${customer} 고객님 · ${date}</text>
    ${amount ? `<text x="72" y="281" fill="#465976" font-family="Noto Sans CJK KR" font-size="30">${variant.amount} ${amount}</text>` : ""}
    <rect x="72" y="340" width="438" height="84" rx="20" fill="#1762d6"/>
    <text x="291" y="394" fill="#ffffff" text-anchor="middle" font-family="Noto Sans KR" font-size="29" font-weight="700">${variant.button}</text>
    <text x="72" y="490" fill="#465976" font-family="Noto Sans CJK KR" font-size="25">문의 ${phone}</text>
  </svg>`;
  const png = new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: [art("korean.otf"), art("korean-bold.ttf")], defaultFontFamily: "Noto Sans CJK KR" } }).render().asPng();
  for (const quality of [82, 72, 60, 48]) {
    const jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length <= 300 * 1024) {
      return { data: jpeg, filename: `${type}.jpg`, contentType: "image/jpeg" };
    }
  }
  throw new Error("문자 이미지가 MMS 용량 제한을 넘었습니다.");
}