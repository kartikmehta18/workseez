-- CreateTable
CREATE TABLE `ContentCalendar` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL DEFAULT 'Content Calendar',
    `cycleStart` DATETIME(3) NULL,
    `cycleLength` INTEGER NOT NULL DEFAULT 30,
    `rawFolderId` VARCHAR(191) NULL,
    `rawFolderUrl` TEXT NULL,
    `editsFolderId` VARCHAR(191) NULL,
    `editsFolderUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NULL,

    UNIQUE INDEX `ContentCalendar_clientId_key`(`clientId`),
    INDEX `ContentCalendar_createdById_fkey`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentPost` (
    `id` VARCHAR(191) NOT NULL,
    `calendarId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'REEL',
    `status` VARCHAR(191) NOT NULL DEFAULT 'SCRIPTING',
    `scheduledFor` DATETIME(3) NULL,
    `sharedAt` DATETIME(3) NULL,
    `needsRawUpload` BOOLEAN NOT NULL DEFAULT false,
    `caption` TEXT NULL,
    `notes` TEXT NULL,
    `rawFileUrl` TEXT NULL,
    `finalEditUrl` TEXT NULL,
    `rawFolderId` VARCHAR(191) NULL,
    `rawFolderUrl` TEXT NULL,
    `editsFolderUrl` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NULL,

    INDEX `ContentPost_calendarId_idx`(`calendarId`),
    INDEX `ContentPost_status_idx`(`status`),
    INDEX `ContentPost_scheduledFor_idx`(`scheduledFor`),
    INDEX `ContentPost_createdById_fkey`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentScriptLine` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `ContentScriptLine_postId_idx`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentComment` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `authorRole` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContentComment_postId_idx`(`postId`),
    INDEX `ContentComment_authorId_fkey`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentAsset` (
    `id` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'RAW',
    `driveFileId` VARCHAR(191) NULL,
    `url` TEXT NULL,
    `mimeType` VARCHAR(191) NULL,
    `sizeBytes` DOUBLE NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContentAsset_postId_idx`(`postId`),
    INDEX `ContentAsset_uploadedById_fkey`(`uploadedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ContentCalendar` ADD CONSTRAINT `ContentCalendar_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentCalendar` ADD CONSTRAINT `ContentCalendar_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentPost` ADD CONSTRAINT `ContentPost_calendarId_fkey` FOREIGN KEY (`calendarId`) REFERENCES `ContentCalendar`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentPost` ADD CONSTRAINT `ContentPost_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentScriptLine` ADD CONSTRAINT `ContentScriptLine_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ContentPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentComment` ADD CONSTRAINT `ContentComment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ContentPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentComment` ADD CONSTRAINT `ContentComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentAsset` ADD CONSTRAINT `ContentAsset_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `ContentPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentAsset` ADD CONSTRAINT `ContentAsset_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
