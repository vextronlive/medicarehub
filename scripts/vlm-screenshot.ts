import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

async function main() {
  const zai = await ZAI.create();
  const imgBuffer = fs.readFileSync("/home/z/my-project/upload/pasted_image_1783679346785.png");
  const b64 = imgBuffer.toString("base64");
  const dataUrl = `data:image/png;base64,${b64}`;

  const res = await zai.chat.completions.createVision({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "This is a screenshot of a healthcare web app. Describe in detail: (1) What screen/page is shown? (2) What is the user trying to do? (3) What error messages, toasts, or feedback are visible? (4) Is there a success toast or error toast? (5) Are there any form fields visible and what values do they have? Be very specific and quote any text you see." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    thinking: { type: "disabled" },
  });

  console.log(res.choices[0]?.message?.content);
}

main().catch(console.error);
