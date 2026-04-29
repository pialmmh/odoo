import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  makeStyles, mergeClasses, tokens, Text, Spinner, Subtitle1, Button,
  Tooltip, Badge, Field, Input, Textarea, Switch, TabList, Tab, Divider,
} from '@fluentui/react-components';
import {
  ArrowLeft20Regular, Box20Regular, ArrowClockwise20Regular,
} from '@fluentui/react-icons';
import { getProduct } from '../../services/erpV2';
import { useNotification } from '../../components/ErrorNotification';

// Read-only product detail — slice 1.
//
// Tabs: General Information / Sales / Purchase.
// Variants, product tags, the "Kill Bill" custom tab, customer/vendor
// tax m2m, chatter, and Save/Edit are intentionally out of scope —
// see ai-docs/erp-react-clone-design.md §8.5 deferred-work tracker.

const useStyles = makeStyles({
  page: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    maxWidth: '1100px',
    marginLeft: 'auto', marginRight: 'auto',
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalM,
  },
  titleRow: {
    display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  productName: {
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  toolbar: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  loaderWrap: { display: 'flex', justifyContent: 'center', paddingTop: 64, paddingBottom: 64 },
  empty: {
    paddingTop: tokens.spacingVerticalXXL, paddingBottom: tokens.spacingVerticalXXL,
    textAlign: 'center', color: tokens.colorNeutralForeground3,
  },
  tabsRow: { marginBottom: tokens.spacingVerticalL },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalL,
    width: '100%',
  },
  span3:  { gridColumn: 'span 3'  },
  span4:  { gridColumn: 'span 4'  },
  span8:  { gridColumn: 'span 8'  },
  span12: { gridColumn: 'span 12' },
  // Centers a Switch in a cell whose sibling has a top-aligned label.
  toggleCell: {
    display: 'flex', alignItems: 'center',
    paddingTop: '26px',
    minHeight: '40px',
  },
  spacer: {},
  bannerNote: {
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalL,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  footerDivider: { marginTop: tokens.spacingVerticalXXL },
  footerCaption: {
    display: 'block',
    marginTop: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

const dash = '—';

export default function ErpV2ProductDetail() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { tenant, id } = useParams();
  const { error: notifyError } = useNotification();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('general');

  const reload = () => {
    setLoading(true);
    getProduct(id)
      .then(setProduct)
      .catch((e) => notifyError('Failed to load product', e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [id]);

  const fmtPrice = (v) => (v == null ? dash : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const txt = (v) => (v == null || v === '' ? '' : String(v));

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.titleRow}>
          <Tooltip content="Back to Products" relationship="label">
            <Button appearance="subtle" icon={<ArrowLeft20Regular />}
              onClick={() => navigate(`/${tenant}/erp-v2/products`)} />
          </Tooltip>
          <Box20Regular />
          <Subtitle1 className={styles.productName}>
            {loading ? 'Loading…' : (product?.name || `Product #${id}`)}
          </Subtitle1>
          {product?.isActive === false && (
            <Badge appearance="outline" size="small" color="subtle">Inactive</Badge>
          )}
        </div>
        <div className={styles.toolbar}>
          <Tooltip content="Refresh" relationship="label">
            <Button appearance="subtle" icon={<ArrowClockwise20Regular />} onClick={reload} />
          </Tooltip>
        </div>
      </div>

      {loading ? (
        <div className={styles.loaderWrap}><Spinner /></div>
      ) : !product ? (
        <div className={styles.empty}>Product #{id} not found.</div>
      ) : (
        <>
          <div className={styles.bannerNote}>
            Read-only view. Editing and pricing land in a later slice.
          </div>

          <div className={styles.tabsRow}>
            <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value)}>
              <Tab value="general">General Information</Tab>
              <Tab value="sales">Sales</Tab>
              <Tab value="purchase">Purchase</Tab>
              <Tab value="attributes">Attributes &amp; Variants</Tab>
            </TabList>
          </div>

          {tab === 'general' && (
            <div className={styles.grid}>
              {/* Row 1: Internal Ref(4) + Name(8) = 12 */}
              <div className={styles.span4}>
                <Field label="Internal Reference">
                  <Input value={txt(product.value)} readOnly />
                </Field>
              </div>
              <div className={styles.span8}>
                <Field label="Name">
                  <Input value={txt(product.name)} readOnly />
                </Field>
              </div>

              {/* Row 2: Type(4) + Category(4) + UoM(4) = 12 */}
              <div className={styles.span4}>
                <Field label="Type">
                  <Input value={txt(product.productTypeLabel || product.productType)} readOnly />
                </Field>
              </div>
              <div className={styles.span4}>
                <Field label="Category">
                  <Input value={txt(product.categoryName)} readOnly />
                </Field>
              </div>
              <div className={styles.span4}>
                <Field label="Unit of Measure">
                  <Input value={txt(product.uomName)} readOnly />
                </Field>
              </div>

              {/* Row 3: Organization(4) + Barcode(4) + SKU(4) = 12 */}
              <div className={styles.span4}>
                <Field label="Organization">
                  <Input value={txt(product.orgName)} readOnly />
                </Field>
              </div>
              <div className={styles.span4}>
                <Field label="Barcode">
                  <Input value={txt(product.upc)} readOnly />
                </Field>
              </div>
              <div className={styles.span4}>
                <Field label="SKU">
                  <Input value={txt(product.sku)} readOnly />
                </Field>
              </div>

              {/* Row 4: 4 toggles, span 3 each = 12 */}
              <div className={mergeClasses(styles.span3, styles.toggleCell)}>
                <Switch label="Active" checked={!!product.isActive} disabled />
              </div>
              <div className={mergeClasses(styles.span3, styles.toggleCell)}>
                <Switch label="Stocked" checked={!!product.isStocked} disabled />
              </div>
              <div className={mergeClasses(styles.span3, styles.toggleCell)}>
                <Switch label="Can be Sold" checked={!!product.isSold} disabled />
              </div>
              <div className={mergeClasses(styles.span3, styles.toggleCell)}>
                <Switch label="Can be Purchased" checked={!!product.isPurchased} disabled />
              </div>

              {/* Row 5: Description(12) */}
              <div className={styles.span12}>
                <Field label="Description">
                  <Textarea value={txt(product.description)} readOnly rows={3} />
                </Field>
              </div>
            </div>
          )}

          {tab === 'sales' && (
            <div className={styles.grid}>
              {/* Row 1: List Price(4) + Tax Class(4) + Sales Rep(4) = 12 */}
              <div className={styles.span4}>
                <Field
                  label="List Price"
                  hint="Real pricing lookup arrives in the next slice."
                >
                  <Input value={fmtPrice(product.listPrice)} readOnly />
                </Field>
              </div>
              <div className={styles.span4}>
                <Field label="Tax Class">
                  <Input value={txt(product.taxCategoryName)} readOnly />
                </Field>
              </div>
              <div className={styles.span4}>
                <Field label="Sales Rep">
                  <Input value={txt(product.salesRepName)} readOnly />
                </Field>
              </div>

              {/* Row 2: Sales Description(12) */}
              <div className={styles.span12}>
                <Field label="Sales Description">
                  <Textarea value={txt(product.salesDescription)} readOnly rows={3} />
                </Field>
              </div>
            </div>
          )}

          {tab === 'purchase' && (
            <div className={styles.grid}>
              {/* Row 1: Standard Cost(4) + spacer(8) = 12 */}
              <div className={styles.span4}>
                <Field
                  label="Standard Cost"
                  hint="Real cost lookup arrives in the next slice."
                >
                  <Input value={fmtPrice(product.standardPrice)} readOnly />
                </Field>
              </div>
              <div className={mergeClasses(styles.span8, styles.spacer)} />

              {/* Row 2: Purchase Description(12) */}
              <div className={styles.span12}>
                <Field label="Purchase Description">
                  <Textarea value={txt(product.purchaseDescription)} readOnly rows={3} />
                </Field>
              </div>
            </div>
          )}

          {tab === 'attributes' && (
            <div className={styles.grid}>
              {/* Row 1: Attribute Set(6) + spacer(6) = 12 */}
              <div className={styles.span6}>
                <Field
                  label="Attribute Set"
                  hint="The named group of attributes assigned to this product (e.g. Color, Size)."
                >
                  <Input value={txt(product.attributeSetName)} readOnly />
                </Field>
              </div>
              <div className={mergeClasses(styles.span6, styles.spacer)} />

              {/* Row 2: notice(12) */}
              <div className={styles.span12}>
                <div className={styles.bannerNote}>
                  Detailed attribute values and per-line combinations
                  surface in a future slice. Combinations on inventory
                  documents are stored against this product as
                  attribute-set instances rather than as separate variant
                  records.
                </div>
              </div>
            </div>
          )}

          <Divider className={styles.footerDivider} />
          <Text className={styles.footerCaption}>
            Product #{product.id}
          </Text>
        </>
      )}
    </div>
  );
}
