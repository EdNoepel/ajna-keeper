const { expect } = require("chai");
const { ethers } = require("hardhat");

describe('SimpleTest', () => {
  it('should find a contract', async () => {
    const [owner] = await ethers.getSigners();
  });
})