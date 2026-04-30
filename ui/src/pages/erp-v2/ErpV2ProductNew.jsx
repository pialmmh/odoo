import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  makeStyles, tokens, Text, Button, Tooltip, Caption1, Spinner, Subtitle1,
  Field, Input, Textarea, Checkbox,
} from '@fluentui/react-components';
import {
  ArrowLeft20Regular, Save20Regular, Box20Regular,
} from '@fluentui/react-icons';
import { createProduct } from '../../services/erpV2';
import { useNotification } from '../../components/ErrorNotification';

// Minimal Create form — slice CRUD-2a. Server applies sane iDempiere
// defaults (Standard category, Each UoM, ProductType=I) so the user only
// has to fill the fields that drive the new row's identity. Pricing,
// category, UoM picking happen on the detail page after creation.

const useStyles = makeStyles({
  page: { backgroundColor: '#f5f5f5', minHeight: '100vh', paddingBottom: tokens.spacingVerticalXXL },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalS, paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL, paddingRight: tokens.spacingHorizontalL,
    backgroundColor: '#ffffff', borderBottom: '1px solid #e0e0e0',
  },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  breadcrumbLink: { color: tokens.colorBrandForeground1, cursor: 'pointer', fontWeight: 600 },
  sheetWrap: {
    paddingTop: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXL, paddingRight: tokens.spacingHorizontalXL,
    maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto',
  },
  sheet: {
    backgroundColor: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    paddingTop: tokens.spacingVerticalXL, paddingBottom: tokens.spacingVerticalXL,
    paddingLeft: tokens.spacingHorizontalXXL, paddingRight: tokens.spacingHorizontalXXL,
  },
  sectionHeading: {
    fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#1a1a1a',
    backgroundColor: tokens.colorBrandBackground2,
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
    borderBottom: `1px solid ${tokens.colorBrandStroke2}`,
    paddingTop: '6px', paddingBottom: '6px',
    paddingLeft: tokens.spacingHorizontalM, paddingRight: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalL, marginBottom: tokens.spacingVerticalM,
  },
  twoCol: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    columnGap: tokens.spacingHorizontalXXL, rowGap: tokens.spacingVerticalM,
  },
  twoColFull: { gridColumn: '1 / -1' },
  scopeRow: {
    display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXL,
    marginTop: tokens.spacingVerticalM,
  },
  actions: {
    display: 'flex', justifyContent: 'flex-end', gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalXL,
  },
});

export default function ErpV2ProductNew() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { tenant } = useParams();
  const { error: notifyError } = useNotification();

  const [name, setName]               = useState('');
  const [value, setValue]             = useState('');
  const [sku, setSku]                 = useState('');
  const [upc, setUpc]                 = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setActive]         = useState(true);
  const [isStocked, setStocked]       = useState(true);
  const [isSold, setSold]             = useState(true);
  const [isPurchased, setPurchased]   = useState(true);
  const [saving, setSaving]           = useState(false);

  const canSave = !!name.trim() && !!value.trim() && !saving;

  const handleSave = () => {
    if (!canSave) return;
    setSaving(true);
    const body = {
      name: name.trim(), value: value.trim(),
      isActive, isStocked, isSold, isPurchased,
    };
    if (sku.trim()) body.sku = sku.trim();
    if (upc.trim()) body.upc = upc.trim();
    if (description.trim()) body.description = description.trim();
    createProduct(body)
      .then((p) => {
        navigate(`/${tenant}/erp-v2/products/${p.id}`);
      })
      .catch((e) => {
        const msg = e.status === 400
          ? (e.message || 'Validation error')
          : (e?.response?.data?.message || e.message);
        notifyError('Failed to create product', msg);
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <div className={styles.breadcrumb}>
          <Tooltip content="Back to Products" relationship="label">
            <Button appearance="subtle" icon={<ArrowLeft20Regular />}
              onClick={() => navigate(`/${tenant}/erp-v2/products`)} />
          </Tooltip>
          <Box20Regular />
          <Text className={styles.breadcrumbLink}
            onClick={() => navigate(`/${tenant}/erp-v2/products`)}>Products</Text>
          <Text>/</Text>
          <Text>New</Text>
        </div>
        <Button appearance="primary" icon={saving ? <Spinner size="tiny" /> : <Save20Regular />}
          onClick={handleSave} disabled={!canSave}>
          {saving ? 'Creating…' : 'Save'}
        </Button>
      </div>

      <div className={styles.sheetWrap}>
        <div className={styles.sheet}>
          <Subtitle1>Create Product</Subtitle1>
          <Caption1 style={{ display: 'block', marginTop: 4, color: '#888' }}>
            Required: Product Name and Internal Reference. Defaults are applied
            for category, UoM, and product type — adjust on the detail page after save.
          </Caption1>

          <div className={styles.sectionHeading}>Identity</div>
          <div className={styles.twoCol}>
            <Field label="Product Name" required>
              <Input value={name} onChange={(_, d) => setName(d.value)}
                placeholder="e.g. Office Chair" />
            </Field>
            <Field label="Internal Reference" required hint="M_Product.Value — must be unique per tenant">
              <Input value={value} onChange={(_, d) => setValue(d.value)}
                placeholder="e.g. CHAIR-001" />
            </Field>
            <Field label="OEM No. / SKU">
              <Input value={sku} onChange={(_, d) => setSku(d.value)} />
            </Field>
            <Field label="UPC / EAN Code">
              <Input value={upc} onChange={(_, d) => setUpc(d.value)} />
            </Field>
            <div className={styles.twoColFull}>
              <Field label="Internal Notes">
                <Textarea value={description} onChange={(_, d) => setDescription(d.value)} rows={3}
                  placeholder="This note is only for internal purposes." />
              </Field>
            </div>
          </div>

          <div className={styles.sectionHeading}>Scope</div>
          <div className={styles.scopeRow}>
            <Checkbox label="Active"           checked={isActive}    onChange={(_, d) => setActive(!!d.checked)} />
            <Checkbox label="Stocked"          checked={isStocked}   onChange={(_, d) => setStocked(!!d.checked)} />
            <Checkbox label="Can be Sold"      checked={isSold}      onChange={(_, d) => setSold(!!d.checked)} />
            <Checkbox label="Can be Purchased" checked={isPurchased} onChange={(_, d) => setPurchased(!!d.checked)} />
          </div>

          <div className={styles.actions}>
            <Button appearance="secondary" onClick={() => navigate(`/${tenant}/erp-v2/products`)}>
              Cancel
            </Button>
            <Button appearance="primary" icon={saving ? <Spinner size="tiny" /> : <Save20Regular />}
              onClick={handleSave} disabled={!canSave}>
              {saving ? 'Creating…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
