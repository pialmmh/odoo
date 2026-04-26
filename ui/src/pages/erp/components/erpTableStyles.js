import { makeStyles, tokens } from '@fluentui/react-components';

/**
 * Shared style hook for ERP / iDempiere-clone data grids.
 *
 * Every list-style screen (Product, BOM, Vendor, Sales Order, …) should reuse
 * these classes so headers, cell weight and row hover behaviour stay uniform
 * across the application. All colours come from Fluent tokens, so a theme
 * palette change cascades through every grid for free.
 *
 * Usage:
 *   const t = useErpTableStyles();
 *   <Table size="small">
 *     <TableHeader>
 *       <TableRow className={t.headerRow}>…</TableRow>
 *     </TableHeader>
 *     <TableBody>
 *       <TableRow className={t.bodyRow}>…</TableRow>
 *     </TableBody>
 *   </Table>
 */
export const useErpTableStyles = makeStyles({
  // Bold + lightly tinted column headers.
  headerRow: {
    '& > th': {
      fontWeight: tokens.fontWeightSemibold,
      color: tokens.colorNeutralForeground1,
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  // Optional: clickable body row with a soft hover tint.
  bodyRow: {
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
    '&:hover': { backgroundColor: tokens.colorNeutralBackground2Hover },
  },
});
