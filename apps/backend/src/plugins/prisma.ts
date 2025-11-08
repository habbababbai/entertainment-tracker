import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";

declare module "fastify" {
    interface FastifyInstance {
        prisma: PrismaClient;
    }
}

const prisma = new PrismaClient();

export const prismaPlugin = fp(async (app) => {
    app.decorate("prisma", prisma);

    app.addHook("onClose", async (instance) => {
        await instance.prisma.$disconnect();
    });
});
