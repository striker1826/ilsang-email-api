import { Core } from "@strapi/strapi";
import nodemailer from "nodemailer";
import schedule from "node-schedule";
import inlineCss from "inline-css";

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const rule = new schedule.RecurrenceRule();
    rule.hour = 7; // 7시
    rule.minute = 0; // 0분
    rule.second = 0;
    rule.dayOfWeek = [5];
    rule.tz = "Asia/Seoul"; // 한국 시간(KST)

    schedule.scheduleJob(rule, async () => {
      const latestArticle = await strapi.db
        .query("api::article.article")
        .findOne({
          orderBy: { createdAt: "desc" }, // 최신순 정렬
        });

      try {
        const emailTemplate = `<!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>오늘의 질문</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            text-align: center;
          }
          .email-container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            padding: 40px 20px;
            text-align: center;
            border-radius: 8px;
            box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
          }
          .title {
            font-weight: 800;
            font-size: 24px;
            color: #2a2a2a;
          }
          .question-box {
            /* background-color: #b8b6b6; */
            color: #2a2a2a;
            font-weight: bold;
            margin: 20px auto;
            padding: 20px;
            font-size: 18px;
            border-radius: 6px;
            max-width: 80%;
          }
          .button {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            font-size: 16px;
            font-weight: bold;
            color: white;
            background-color: #007bff;
            text-decoration: none;
            border-radius: 6px;
            transition: 0.3s;
          }
          .button:hover {
            background-color: #0056b3;
          }
          .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #888;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <h1 class="title">오늘의 질문</h1>
          <div class="question-box">${latestArticle.title}</div>
          <a href="${process.env.APP_URL}/articles/${latestArticle.documentId}" class="button">아티클 읽기</a>
          <p class="footer">© 2025 일상백과. All rights reserved.</p>
        </div>
      </body>
    </html>`;

        const inlinedHtml = await inlineCss(emailTemplate, { url: " " });

        const sendMail = async (to: string) => {
          const mailOptions = {
            from: `"일상백과" <${process.env.GMAIL_USER}>`, // 보내는 사람
            to,
            subject: `📢 [일상백과] ${latestArticle.title}`,
            text: "이 메일은 일상백과로부터 발송되었습니다.",
            html: inlinedHtml,
          };

          await transporter.sendMail(mailOptions);
          console.log(
            `✅ Email sent: ${mailOptions.subject} ${mailOptions.to}`
          );
        };

        const subscribers = await strapi.db
          .query("api::subscriber.subscriber")
          .findMany({
            where: {
              publishedAt: {
                $notNull: true,
              },
            },
          });

        const uniqueSubscribers = Array.from(
          new Map(subscribers.map((sub) => [sub.email, sub])).values()
        );

        uniqueSubscribers?.forEach((subscriber) => {
          sendMail(subscriber.email);
        });
      } catch (error) {
        console.error("❌ Email send error:", error);
      }
    });

    console.log("✅ Email scheduler is running...");
  },
};
