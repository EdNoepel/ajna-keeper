import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { decimaledToWei, weiToDecimaled } from '../utils';

describe('bigToWadNumber', () => {
  const convertsWeiToEth = (inStr: string, out: number) => {
    it(`converts wei:${inStr} to Eth:${out.toString()}`, () => {
      expect(weiToDecimaled(BigNumber.from(inStr))).to.equal(out);
    });
  };

  convertsWeiToEth('0', 0);
  convertsWeiToEth('10000000000000', 1e-5);
  convertsWeiToEth('11000000000000', 1.1e-5);
  convertsWeiToEth('100000000000000000', 0.1);
  convertsWeiToEth('110000000000000000', 0.11);
  convertsWeiToEth('1000000000000000000', 1);
  convertsWeiToEth('1100000000000000000', 1.1);
  convertsWeiToEth('10000000000000000000', 10);
  convertsWeiToEth('11000000000000000000', 11);
  convertsWeiToEth('100000000000000000000000', 1e5);
  convertsWeiToEth('110000000000000000000000', 1.1e5);
  convertsWeiToEth('-10000000000000', -1e-5);
  convertsWeiToEth('-11000000000000', -1.1e-5);
  convertsWeiToEth('-100000000000000000', -0.1);
  convertsWeiToEth('-110000000000000000', -0.11);
  convertsWeiToEth('-1000000000000000000', -1);
  convertsWeiToEth('-1100000000000000000', -1.1);
  convertsWeiToEth('-10000000000000000000', -10);
  convertsWeiToEth('-11000000000000000000', -11);
  convertsWeiToEth('-110000000000000000000000', -1.1e5);
  convertsWeiToEth('-111111111111100000000000', -1.111111111111e5);
});

describe('weiToDecimaled', () => {
  const convertsEthToWei = (inNumb: number, outStr: string) => {
    it(`converts Eth:${inNumb.toString()} to wei:${outStr}`, () => {
      expect(decimaledToWei(inNumb).toString()).to.equal(outStr);
    });
  };

  convertsEthToWei(0, '0');
  convertsEthToWei(1e-5, '10000000000000');
  convertsEthToWei(1.1e-5, '11000000000000');
  convertsEthToWei(0.1, '100000000000000000');
  convertsEthToWei(0.11, '110000000000000000');
  convertsEthToWei(1, '1000000000000000000');
  convertsEthToWei(1.1, '1100000000000000000');
  convertsEthToWei(10, '10000000000000000000');
  convertsEthToWei(11, '11000000000000000000');
  convertsEthToWei(1e5, '100000000000000000000000');
  convertsEthToWei(1.1e5, '110000000000000000000000');
  convertsEthToWei(-1e-5, '-10000000000000');
  convertsEthToWei(-1.1e-5, '-11000000000000');
  convertsEthToWei(-0.1, '-100000000000000000');
  convertsEthToWei(-0.11, '-110000000000000000');
  convertsEthToWei(-1, '-1000000000000000000');
  convertsEthToWei(-1.1, '-1100000000000000000');
  convertsEthToWei(-10, '-10000000000000000000');
  convertsEthToWei(-11, '-11000000000000000000');
  convertsEthToWei(-1.1e5, '-110000000000000000000000');
});
