import Papa from "papaparse";

export function createCsv(
  data: unknown[]
): string {
  return Papa.unparse(
    data
  );
}