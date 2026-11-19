import { Complex } from "../math/Complex";

console.log("=== TESTE INICIADO ===");

const z1 = new Complex(10, 5);
const z2 = new Complex(20, -10);

const resultado = z1.add(z2);

console.log("z1 =", z1);
console.log("z2 =", z2);
console.log("resultado =", resultado);
console.log("resultado texto =", resultado.toString());
