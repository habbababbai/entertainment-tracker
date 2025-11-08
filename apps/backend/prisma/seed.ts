// Fix for process.exit()
/// <reference types="node" />

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const users = [
    {
        email: "jane.doe@example.com",
        username: "janedoe",
    },
    {
        email: "john.smith@example.com",
        username: "johnsmith",
    },
    {
        email: "anime.fan@example.com",
        username: "animefan",
    },
];

async function main(): Promise<void> {
    console.info("Clearing existing user data…");
    await prisma.episodeProgress.deleteMany();
    await prisma.watchEntry.deleteMany();
    await prisma.user.deleteMany();

    console.info(`Seeding ${users.length} users…`);
    await prisma.user.createMany({
        data: users,
        skipDuplicates: true,
    });

    console.info("User seed complete ✅");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });
