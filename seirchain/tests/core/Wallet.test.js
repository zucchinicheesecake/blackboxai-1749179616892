const Wallet = require('../../src/core/Wallet');

describe('Wallet', () => {
  let wallet;

  beforeEach(() => {
    wallet = new Wallet();
  });

  test('should create a new wallet instance', () => {
    expect(wallet).toBeInstanceOf(Wallet);
  });

  test('should generate a new key pair', () => {
    const { publicKey, privateKey, address } = wallet.generateKeyPair();
    
    expect(publicKey).toBeDefined();
    expect(privateKey).toBeDefined();
    expect(address).toBeDefined();
    
    expect(typeof publicKey).toBe('string');
    expect(typeof privateKey).toBe('string');
    expect(typeof address).toBe('string');
    
    expect(publicKey.length).toBeGreaterThan(0);
    expect(privateKey.length).toBe(64); // 32 bytes in hex
    expect(address.startsWith('seir')).toBe(true);
  });

  test('should sign and verify data', () => {
    const testData = { message: 'Hello, SeirChain!' };
    wallet.generateKeyPair();
    
    const signature = wallet.signData(testData);
    
    expect(signature).toBeDefined();
    expect(signature.r).toBeDefined();
    expect(signature.s).toBeDefined();
    expect(signature.recoveryParam).toBeDefined();
    
    const isValid = Wallet.verifySignature(
      testData,
      signature,
      wallet.getPublicKey()
    );
    
    expect(isValid).toBe(true);
  });

  test('should import private key correctly', () => {
    const { privateKey: generatedKey } = wallet.generateKeyPair();
    const newWallet = new Wallet();
    
    const success = newWallet.importFromPrivateKey(generatedKey);
    
    expect(success).toBe(true);
    expect(newWallet.getPrivateKey()).toBe(generatedKey);
  });

  test('should reject invalid private key', () => {
    expect(() => {
      wallet.importFromPrivateKey('invalid_key');
    }).toThrow();
  });
});
