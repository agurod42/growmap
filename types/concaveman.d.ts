declare module "concaveman" {
  type InputPoint = [number, number];

  function concaveman(points: InputPoint[], concavity?: number, lengthThreshold?: number): InputPoint[];

  export default concaveman;
}
