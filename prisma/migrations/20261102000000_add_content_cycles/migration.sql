-- CreateTable
-- Hand-set dates for individual cycles. Only edited cycles get a row; every
-- other cycle is still derived from ContentCalendar.cycleStart/cycleLength, so
-- nothing is backfilled.
CREATE TABLE `ContentCycle` (
    `id` VARCHAR(191) NOT NULL,
    `calendarId` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ContentCycle_calendarId_number_key`(`calendarId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ContentCycle` ADD CONSTRAINT `ContentCycle_calendarId_fkey` FOREIGN KEY (`calendarId`) REFERENCES `ContentCalendar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
