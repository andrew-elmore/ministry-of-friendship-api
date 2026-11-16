describe('Cloud Functions', () => {
  const mockFunctions = {};

  beforeAll(() => {
    global.Parse = {
      Cloud: {
        define: (name, handler) => { mockFunctions[name] = handler; },
        beforeSave: jest.fn(),
        beforeDelete: jest.fn(),
        beforeFind: jest.fn(),
      },
    };
    require('../../cloud/main');
  });

  afterAll(() => {
    delete global.Parse;
  });

  describe('ping', () => {
    it('should return pong', async () => {
      const result = await mockFunctions.ping();
      expect(result).toBe('pong');
    });
  });

});
