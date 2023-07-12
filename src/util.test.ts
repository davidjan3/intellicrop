//test for Util.closestPoint, which returns the closest point on a houghline to a given point:
import Util, { Line, Pt } from "./util";

describe("Util.closestPoint", () => {
  it("should return the closest point on a houghline to a given point", () => {
    {
      const line: Line = {
        rho: 10,
        theta: Math.PI * 0.25,
      };
      const pt: Pt = [3, 3];
      const closestPt = Util.closestPoint(line, pt);
      expect(closestPt[0]).toBeCloseTo(7.07107);
      expect(closestPt[1]).toBeCloseTo(7.07107);
    }

    {
      const line: Line = {
        rho: 10,
        theta: Math.PI * 0.5,
      };
      const pt: Pt = [3, 3];
      const closestPt = Util.closestPoint(line, pt);
      expect(closestPt[0]).toBeCloseTo(3);
      expect(closestPt[1]).toBeCloseTo(10);
    }

    {
      const line: Line = {
        rho: 10,
        theta: 0,
      };
      const pt: Pt = [3, 3];
      const closestPt = Util.closestPoint(line, pt);
      expect(closestPt[0]).toBeCloseTo(10);
      expect(closestPt[1]).toBeCloseTo(3);
    }
  });
});

describe("Util.lineThrough", () => {
  it("should return hough line going through two provided coordinates", () => {
    {
      const pt0: Pt = [0, 0];
      const pt1: Pt = [5, 5];
      const line = Util.lineThrough(pt0, pt1);
      expect(line.rho).toBeCloseTo(0);
      expect(line.theta).toBeCloseTo(Math.PI * 0.75);
    }

    {
      const pt0: Pt = [5, 0];
      const pt1: Pt = [5, 5];
      const line = Util.lineThrough(pt0, pt1);
      expect(line.rho).toBeCloseTo(-5);
      expect(line.theta).toBeCloseTo(Math.PI);
    }

    {
      const pt0: Pt = [0, 5];
      const pt1: Pt = [5, 5];
      const line = Util.lineThrough(pt0, pt1);
      expect(line.rho).toBeCloseTo(5);
      expect(line.theta).toBeCloseTo(Math.PI * 0.5);
    }

    {
      const pt0: Pt = [0, 10];
      const pt1: Pt = [10, 0];
      const line = Util.lineThrough(pt0, pt1);
      expect(line.rho).toBeCloseTo(7.07107);
      expect(line.theta).toBeCloseTo(Math.PI * 0.25);
    }

    {
      const pt0: Pt = [50, 0];
      const pt1: Pt = [55, 5];
      const line = Util.lineThrough(pt0, pt1);
      expect(line.rho).toBeCloseTo(-35.35533905932738);
      expect(line.theta).toBeCloseTo(Math.PI * 0.75);
    }
  });
});

describe("Util.mapObj", () => {
  it("should map an object", () => {
    {
      const obj = { a: 1, c: 3, b: 2 };
      const mapped = Util.mapObj(obj, (v) => v * 2);
      expect(JSON.stringify(mapped)).toEqual('{"a":2,"c":6,"b":4}');
    }

    {
      const obj = { a: "1", b: "2", c: "3" };
      const mapped = Util.mapObj(obj, (v, k) => v + k);
      expect(JSON.stringify(mapped)).toEqual('{"a":"1a","b":"2b","c":"3c"}');
    }
  });
});
