const syncLedger = require('../../src/ledger/ledgerSync');

describe('Ledger Sync Function', () => {
    it('should successfully sync the ledger if the database is open', async () => {
        // Create a mock db connection that is open for new users
        const mockDb = {
            isOpenForNewUsers: jest.fn().mockReturnValue(true),
            updateLedger: jest.fn().mockResolvedValue('Ledger updated')
        };

        const ledgerData = {
            entries: [
                { id: 1, data: 'test data 1' },
                { id: 2, data: 'test data 2' }
            ]
        };

        const result = await syncLedger(mockDb, ledgerData);
        
        expect(result.status).toBe('success');
        expect(mockDb.isOpenForNewUsers).toHaveBeenCalled();
        expect(mockDb.updateLedger).toHaveBeenCalledWith(ledgerData);
    });

    it('should throw an error if the database is not open for new users', async () => {
        // Create a mock db connection that is not open for new users
        const mockDb = {
            isOpenForNewUsers: jest.fn().mockReturnValue(false),
            updateLedger: jest.fn()
        };

        const ledgerData = {
            entries: [
                { id: 1, data: 'test data 1' }
            ]
        };

        await expect(syncLedger(mockDb, ledgerData))
            .rejects
            .toThrow('Database is not open for new users');
        
        expect(mockDb.isOpenForNewUsers).toHaveBeenCalled();
        expect(mockDb.updateLedger).not.toHaveBeenCalled();
    });

    it('should handle database update errors properly', async () => {
        // Create a mock db connection that throws an error during update
        const mockDb = {
            isOpenForNewUsers: jest.fn().mockReturnValue(true),
            updateLedger: jest.fn().mockRejectedValue(new Error('Update failed'))
        };

        const ledgerData = {
            entries: [
                { id: 1, data: 'test data 1' }
            ]
        };

        await expect(syncLedger(mockDb, ledgerData))
            .rejects
            .toThrow('Update failed');
        
        expect(mockDb.isOpenForNewUsers).toHaveBeenCalled();
        expect(mockDb.updateLedger).toHaveBeenCalledWith(ledgerData);
    });
});
