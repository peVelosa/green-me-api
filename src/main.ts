import fastify from "fastify";
import openai from "./lib/open-ai.js";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import fs from "node:fs";
import util from "util";
import { pipeline } from "stream";
import { v4 as uuidv4 } from "uuid";
import { extractJSON } from "./helpers/index.js";

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

    const chunks = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    const base64_image = buffer.toString("base64");

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é uma IA que reconhece imagens. Você receberá uma imagem de uma planta. Você precisa responder com o nome da planta e uma possível doença que ela possa ter.
          Responda **apenas** com um objeto JSON no seguinte formato, sem nenhum texto adicional ou blocos de código: {
            "type": string (tipo da planta),
            "family": string (família da planta), 
            "scientific_name": string (nome científico da planta), 
            "disease": string | null,
            "info": {
              "water_frequency": string (Você deve usar os seguintes valores: "diariamente", "semanalmente", "mensalmente" e a frequência. Ex: 1x diariamente),
              "light": string (sol pleno, sol parcial, sombra),
              "toxicity": boolean (true, false)
            },
            "confidence": number (0-1)
          }
          Se não houver doença, você pode deixar o campo "disease" como null.
          Se sua confiança for menor que 0.8, responda com { "error": "Confiança baixa, por favor, tente novamente." }
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

    return extractJSON(text ?? "");
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
