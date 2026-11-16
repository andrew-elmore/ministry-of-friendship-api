global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

jest.setTimeout(10000);
