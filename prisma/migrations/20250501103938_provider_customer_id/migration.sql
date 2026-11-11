/*
  Warnings:

  - You are about to drop the column `referenceId` on the `subscription` table. All the data in the column will be lost.
  - Added the required column `providerCustomerId` to the `onetimepurchase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `providerCustomerId` to the `subscription` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_onetimepurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "providerCustomerId" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "onetimepurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_onetimepurchase" ("created_at", "id", "product", "updated_at", "userId") SELECT "created_at", "id", "product", "updated_at", "userId" FROM "onetimepurchase";
DROP TABLE "onetimepurchase";
ALTER TABLE "new_onetimepurchase" RENAME TO "onetimepurchase";
CREATE TABLE "new_subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "providerCustomerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_subscription" ("created_at", "id", "product", "status", "updated_at", "userId") SELECT "created_at", "id", "product", "status", "updated_at", "userId" FROM "subscription";
DROP TABLE "subscription";
ALTER TABLE "new_subscription" RENAME TO "subscription";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
