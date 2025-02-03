import { BigNumber } from 'ethers';

function bigToScientific(bn: BigNumber): {
  mantissa: number;
  exponent10: number;
} {
  const bnStr = bn.toString();
  const numbStart = bnStr.startsWith('-') ? 1 : 0;
  const mantissa = parseFloat(
    bnStr.slice(0, numbStart + 1) + '.' + bnStr.slice(numbStart + 1, 14)
  );
  const exponent10 = bnStr.length - (1 + numbStart);
  return { mantissa, exponent10 };
}

function weiToDecimaled(bn: BigNumber, tokenDecimals: number = 18): number {
  const scientific = bigToScientific(bn);
  scientific.exponent10 -= tokenDecimals;
  return parseFloat(scientific.mantissa + 'e' + scientific.exponent10);
}

console.log(
  'collateralization:',
  weiToDecimaled(BigNumber.from('0x0661020080e2f89c'))
);
console.log('debt:', weiToDecimaled(BigNumber.from('0x03b35757cbe57c7d1066')));
console.log(
  'collateral:',
  weiToDecimaled(BigNumber.from('0x04713a8dfb3e9c00'))
);
console.log(
  'thresholdPrice:',
  weiToDecimaled(BigNumber.from('0x0c05e21ce367a4a20469'))
);
console.log(
  'neutralPrice:',
  weiToDecimaled(BigNumber.from('0x0e23a6b2d53f82ea1712'))
);
console.log(
  'liquidationBond:',
  weiToDecimaled(BigNumber.from('0x10acd11bb1bc9be245'))
);
