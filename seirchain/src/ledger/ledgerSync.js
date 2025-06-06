"use strict";

const logger = require('../utils/logger');
const ErrorHandler = require('../utils/errorHandler');

/**
 * Syncs ledger data if the database connection is accepting new users.
 * @param {Object} dbConnection - Ledger database connection object.
 *   It must have:
 *     • isOpenForNewUsers() – function that returns a Boolean.
 *     • updateLedger(ledgerData) – function that updates the ledger.
 * @param {Object} ledgerData - The ledger updates to sync.
 * @returns {Promise<Object>} - Returns a promise that resolves with a sync status.
 */
async function syncLedger(dbConnection, ledgerData) {
    try {
        // Check if the database is available for new updates
        if (!dbConnection.isOpenForNewUsers()) {
            const errMsg = "Database is not open for new users";
            logger.warn(errMsg);
            throw new Error(errMsg);
        }

        // Update the ledger with provided data
        await dbConnection.updateLedger(ledgerData);
        logger.info("Ledger sync successfully completed");
        return { status: "success" };
    } catch (error) {
        // Centralize error logging and handling
        ErrorHandler.handleError(error, "Ledger Sync");
        logger.error("Failed ledger sync: " + error.message);
        throw error;
    }
}

module.exports = syncLedger;
