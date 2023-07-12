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
