import fastify from "fastify";
import openai from "./lib/open-ai.js";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import fs from "node:fs";
import util from "util";
import { pipeline } from "stream";
import { v4 as uuidv4 } from "uuid";

const pump = util.promisify(pipeline);

const app = fastify({
  logger: true,
});

const start = async () => {
  await app.register(multipart);
  await app.register(cors, {
    origin: "*",
    methods: ["POST"],
  });

  app.get("/health-check", async (request, reply) => {
    return { status: "ok" };
  });

  app.post("/upload", async (request, reply) => {
    const file = await request.file();

    if (!file) return reply.send("No file uploaded");

    const uuid = uuidv4();

    const fileName = `./uploads/${uuid}.${file.mimetype.split("/")[1]}`;

    await pump(file.file, fs.createWriteStream(fileName));

    const base64_image = fs.readFileSync(fileName, "base64");

    fs.unlinkSync(fileName);

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "assistant",
          content: `You are an AI that recognizes images. You will receive an image of a plant. You need to answer the plant's name and a possible disease that it might have.
            You must answer in the following format: {
              "plant_name": string,
              "disease": string | null,
              "info":{
                "water_frequency": string (You must use the following values: "daily", "weekly", "monthly" and the frequency. EX: 1x daily),
                "light": string (full sun, partial sun, shade),
                "toxicity": boolean (true, false),
              },
              "confidence": number (0-1)
            }
            If there is no disease, you can leave the "disease" field if null.
            If your confidence is less than 0.8, you must retry and re-evaluate the image.
            `,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${file.mimetype};base64,${base64_image}`,
              },
            },
          ],
        },
      ],
    });

    const text = res.choices[0].message.content;

    return text;
  });

  try {
    await app.listen({
      port: process.env.PORT ? Number(process.env.PORT) : 3333,
      host: "0.0.0.0",
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
