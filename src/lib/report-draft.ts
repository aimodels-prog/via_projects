import { z } from "zod";
import { reportSchema } from "./report.types";

// Setup can be saved before the first reporting month. JSON null round-trips to an empty
// numeric input, never to zero. Publishing/exporting still uses the strict report schema.
const numberInput = z.union([z.number(), z.nan(), z.null()]).transform((v) => v ?? NaN);
const textInput = z.string().max(2000);
export const draftReportSchema = reportSchema.extend({
  projectName: textInput,
  region: textInput,
  reportMonth: textInput,
  dataAsOf: textInput,
  contractValue: textInput,
  awardDate: textInput,
  startDate: textInput,
  completionDate: textInput,
  clientName: textInput,
  brief: z.string().max(20000),
  mobilizationDays: numberInput,
  constructionDays: numberInput,
  elapsedDays: numberInput,
  remainingDays: numberInput,
  plannedProgress: numberInput,
  actualProgress: numberInput,
  variance: numberInput,
  financialProgress: numberInput,
  plannedMachinery: numberInput,
  actualMachinery: numberInput,
  plannedManpower: numberInput,
  actualManpower: numberInput,
  photos: z
    .array(reportSchema.shape.photos.element.extend({ caption: z.string().max(500) }))
    .max(4),
});
