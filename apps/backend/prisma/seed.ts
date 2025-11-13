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

const mediaItems = [
    {
        externalId: "chainsaw-man-reze-arc",
        source: "manual",
        title: "Chainsaw Man – The Reze Arc",
        description:
            "Feature-length adaptation of Tatsuki Fujimoto's Chainsaw Man manga covering the Bomb Girl arc, following Denji's encounter with the mysterious Reze.",
        posterUrl:
            "https://en.wikipedia.org/wiki/Chainsaw_Man_%E2%80%93_The_Movie:_Reze_Arc#/media/File:Chainsaw_Man_Reze_Arc_movie_poster.jpg",
        mediaType: "ANIME" as const,
        totalEpisodes: 1,
    },
];

async function main(): Promise<void> {
    console.info("Clearing existing data…");
    await prisma.episodeProgress.deleteMany();
    await prisma.watchEntry.deleteMany();
    await prisma.mediaItem.deleteMany();
    await prisma.user.deleteMany();

    console.info(`Seeding ${users.length} users…`);
    for (const user of users) {
        await prisma.user.upsert({
            where: { email: user.email },
            update: {
                username: user.username,
            },
            create: user,
        });
    }

    console.info("Seeding Chainsaw Man movie metadata…");
    const chainsawManMovie = await prisma.mediaItem.upsert({
        where: { externalId: mediaItems[0].externalId },
        update: {
            title: mediaItems[0].title,
            description: mediaItems[0].description,
            posterUrl: mediaItems[0].posterUrl,
            mediaType: mediaItems[0].mediaType,
            totalEpisodes: mediaItems[0].totalEpisodes,
        },
        create: mediaItems[0],
    });

    const animeFan = await prisma.user.findUnique({
        where: { email: "anime.fan@example.com" },
    });

    if (animeFan) {
        await prisma.watchEntry.upsert({
            where: {
                userId_mediaItemId: {
                    userId: animeFan.id,
                    mediaItemId: chainsawManMovie.id,
                },
            },
            update: {
                status: "PLANNED",
            },
            create: {
                userId: animeFan.id,
                mediaItemId: chainsawManMovie.id,
                status: "PLANNED",
            },
        });
    }

    console.info("Seed complete ✅");
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
