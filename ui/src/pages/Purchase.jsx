import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Stepper, Step, StepLabel,
  Button, Grid, TextField, MenuItem, Select, FormControl, InputLabel,
  Chip, Alert, CircularProgress, Table, TableHead, TableBody,
  TableRow, TableCell, Radio, RadioGroup, FormControlLabel, Divider,
} from '@mui/material';
import {
  ShoppingCart as CartIcon, CheckCircle as DoneIcon,
  ArrowBack as BackIcon, ArrowForward as NextIcon,
} from '@mui/icons-material';
import { useNotification } from '../components/ErrorNotification';
import { call } from '../services/odoo';
import {
  getCatalog, createAccount, createSubscription,
  getAccountByKey, payInvoice, addExternalCharge,
  getAccountInvoicesList, getInvoice, addPaymentMethod,
} from '../services/killbill';

const STEPS = ['Select Customer', 'Choose Plan', 'Review & Confirm', 'Complete'];

export default function Purchase() {
  const [step, setStep] = useState(0);
  const [partners, setPartners] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Step 1
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [kbAccount, setKbAccount] = useState(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Step 2
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [otcAmount, setOtcAmount] = useState(0);
  const [otcDescription, setOtcDescription] = useState('Connection Fee (One-Time)');

  // Step 3-4
  const [purchasing, setPurchasing] = useState(false);
  const [result, setResult] = useState(null);

  const { success, error: notifyError } = useNotification();

  // Load partners and catalog
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, catResp] = await Promise.all([
          call('res.partner', 'search_read', [[['is_company', '=', true]]], { fields: ['id', 'name', 'email', 'phone', 'x_external_key'] }),
          getCatalog(),
        ]);
        setPartners(p);

        // Parse plans from catalog (use latest version)
        const catalogs = catResp.data;
        if (Array.isArray(catalogs) && catalogs.length > 0) {
          const latest = catalogs[catalogs.length - 1];
          const allPlans = [];
          for (const prod of latest.products || []) {
            for (const plan of prod.plans || []) {
              const phases = plan.phases || [];
              let monthlyPrice = 0;
              let otc = 0;
              for (const ph of phases) {
                if (ph.type === 'EVERGREEN' && ph.recurringPrices?.length > 0) {
                  monthlyPrice = ph.recurringPrices[0].value || 0;
                }
                if (ph.type === 'FIXEDTERM' && ph.fixedPrices?.length > 0) {
                  otc = ph.fixedPrices[0].value || 0;
                }
              }
              allPlans.push({
                planName: plan.name,
                productName: prod.name,
                productType: prod.type,
                billingPeriod: plan.billingPeriod,
                monthlyPrice,
                otc,
              });
            }
          }
          setPlans(allPlans);
        }
      } catch (e) {
        notifyError('Failed to load data', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Step 1: Select partner and ensure KB account exists
  const handleSelectPartner = async (partner) => {
    setSelectedPartner(partner);
    setCreatingAccount(true);
    try {
      const extKey = partner.x_external_key || `odoo-partner-${partner.id}`;
      // Try to find existing KB account
      let acct = null;
      try {
        const resp = await getAccountByKey(extKey);
        acct = resp.data;
      } catch {
        // Account doesn't exist — create it
        const resp = await createAccount({
          name: partner.name,
          externalKey: extKey,
          email: partner.email || '',
          currency: 'BDT',
          company: partner.name,
          country: 'BD',
          locale: 'en_US',
          timeZone: 'Asia/Dhaka',
        });
        // Get the created account
        const acctResp = await getAccountByKey(extKey);
        acct = acctResp.data;

        // Ensure external payment method exists
        try {
          await addPaymentMethod(acct.accountId, {
            pluginName: '__EXTERNAL_PAYMENT__',
            pluginInfo: {},
          });
        } catch { /* may already exist */ }
      }
      setKbAccount(acct);
      setStep(1);
    } catch (e) {
      notifyError('Failed to set up account', e.message);
    } finally {
      setCreatingAccount(false);
    }
  };

  // Step 3: Purchase
  const handlePurchase = async () => {
    if (!kbAccount || !selectedPlan) return;
    setPurchasing(true);
    try {
      // 1. Create subscription
      await createSubscription({
        accountId: kbAccount.accountId,
        planName: selectedPlan.planName,
      });

      // 2. Add OTC external charge if specified
      let otcInvoiceId = null;
      if (otcAmount > 0) {
        const chargeResp = await addExternalCharge(kbAccount.accountId, [{
          accountId: kbAccount.accountId,
          amount: otcAmount,
          currency: 'BDT',
          description: `${selectedPlan.productName} - ${otcDescription}`,
        }]);
        if (chargeResp.data?.[0]?.invoiceId) {
          otcInvoiceId = chargeResp.data[0].invoiceId;
        }
      }

      // 3. Get invoices to show summary
      const invResp = await getAccountInvoicesList(kbAccount.accountId);
      const invoices = [];
      for (const inv of invResp.data || []) {
        try {
          const fullInv = await getInvoice(inv.invoiceId);
          if (fullInv.data.amount > 0) invoices.push(fullInv.data);
        } catch {}
      }

      setResult({
        success: true,
        partner: selectedPartner.name,
        plan: selectedPlan,
        otcAmount,
        invoices,
      });
      setStep(3);
      success('Subscription created successfully');
    } catch (e) {
      setResult({ success: false, error: e.message });
      setStep(3);
      notifyError('Purchase failed', e.message);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>Purchase Subscription</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create a new subscription on behalf of a customer
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      {/* Step 0: Select Customer */}
      {step === 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Select Customer (Partner)</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {partners.map(p => (
                  <TableRow key={p.id} hover>
                    <TableCell><Typography fontWeight={600} fontSize={13}>{p.name}</Typography></TableCell>
                    <TableCell>{p.email || '-'}</TableCell>
                    <TableCell>{p.phone || '-'}</TableCell>
                    <TableCell align="center">
                      <Button size="small" variant="outlined" onClick={() => handleSelectPartner(p)}
                        disabled={creatingAccount}>
                        {creatingAccount && selectedPartner?.id === p.id ? 'Setting up...' : 'Select'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Choose Plan */}
      {step === 1 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Choose Plan for {selectedPartner?.name}
            </Typography>
            <Chip label={`KB Account: ${kbAccount?.accountId?.slice(0, 8)}...`} size="small" sx={{ mb: 2 }} />

            <RadioGroup value={selectedPlan?.planName || ''} onChange={(e) => {
              const plan = plans.find(p => p.planName === e.target.value);
              setSelectedPlan(plan);
              setOtcAmount(plan?.otc || 0);
            }}>
              <Grid container spacing={1}>
                {plans.filter(p => p.productType === 'BASE').map(plan => (
                  <Grid size={{ xs: 12, sm: 6 }} key={plan.planName}>
                    <Card variant="outlined" sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      borderColor: selectedPlan?.planName === plan.planName ? 'primary.main' : '#e0e0e0',
                      borderWidth: selectedPlan?.planName === plan.planName ? 2 : 1,
                    }}
                      onClick={() => { setSelectedPlan(plan); setOtcAmount(plan.otc || 0); }}>
                      <FormControlLabel
                        value={plan.planName}
                        control={<Radio size="small" />}
                        label={
                          <Box>
                            <Typography fontWeight={600} fontSize={13}>{plan.productName}</Typography>
                            <Typography fontSize={12} color="text.secondary">
                              {plan.monthlyPrice.toLocaleString()} BDT/{plan.billingPeriod?.toLowerCase() || 'month'}
                              {plan.otc > 0 && ` + ${plan.otc.toLocaleString()} BDT OTC`}
                            </Typography>
                          </Box>
                        }
                      />
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </RadioGroup>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>One-Time Charge (Optional)</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <TextField fullWidth size="small" label="OTC Amount (BDT)" type="number"
                  value={otcAmount} onChange={e => setOtcAmount(+e.target.value || 0)} />
              </Grid>
              <Grid size={{ xs: 8 }}>
                <TextField fullWidth size="small" label="OTC Description"
                  value={otcDescription} onChange={e => setOtcDescription(e.target.value)} />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button startIcon={<BackIcon />} onClick={() => setStep(0)}>Back</Button>
              <Button variant="contained" endIcon={<NextIcon />} onClick={() => setStep(2)}
                disabled={!selectedPlan}>
                Review
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>Review Order</Typography>

            <Table size="small" sx={{ mb: 2 }}>
              <TableBody>
                <TableRow><TableCell sx={{ fontWeight: 600 }}>Customer</TableCell><TableCell>{selectedPartner?.name}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600 }}>Product</TableCell><TableCell>{selectedPlan?.productName}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600 }}>Plan</TableCell><TableCell>{selectedPlan?.planName}</TableCell></TableRow>
                <TableRow><TableCell sx={{ fontWeight: 600 }}>Monthly</TableCell><TableCell>{selectedPlan?.monthlyPrice.toLocaleString()} BDT</TableCell></TableRow>
                {otcAmount > 0 && (
                  <TableRow><TableCell sx={{ fontWeight: 600 }}>One-Time Fee</TableCell><TableCell>{otcAmount.toLocaleString()} BDT — {otcDescription}</TableCell></TableRow>
                )}
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>First Invoice (est.)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{(selectedPlan?.monthlyPrice + otcAmount).toLocaleString()} BDT</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Alert severity="info" sx={{ fontSize: 12, mb: 2 }}>
              This will create a Kill Bill subscription and generate an invoice. Payment can be recorded separately from the Invoices page.
            </Alert>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button startIcon={<BackIcon />} onClick={() => setStep(1)}>Back</Button>
              <Button variant="contained" startIcon={<CartIcon />} onClick={handlePurchase}
                disabled={purchasing} color="primary">
                {purchasing ? 'Processing...' : 'Confirm Purchase'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Complete */}
      {step === 3 && result && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            {result.success ? (
              <>
                <DoneIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                <Typography variant="h6" fontWeight={700} gutterBottom>Purchase Complete</Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {result.plan.productName} subscription created for {result.partner}
                </Typography>

                {result.invoices.length > 0 && (
                  <Box sx={{ maxWidth: 500, mx: 'auto', textAlign: 'left' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Invoices Generated:</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>#</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right">Balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.invoices.map(inv => (
                          <TableRow key={inv.invoiceId}>
                            <TableCell>{inv.invoiceNumber}</TableCell>
                            <TableCell>
                              {(inv.items || []).map(i => i.description || i.phaseName || i.planName).join(', ')}
                            </TableCell>
                            <TableCell align="right">{inv.amount} BDT</TableCell>
                            <TableCell align="right">
                              <Chip label={`${inv.balance} BDT`} size="small"
                                color={inv.balance > 0 ? 'warning' : 'success'} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}

                <Button variant="outlined" sx={{ mt: 3 }} onClick={() => {
                  setStep(0); setSelectedPartner(null); setSelectedPlan(null);
                  setKbAccount(null); setResult(null); setOtcAmount(0);
                }}>
                  New Purchase
                </Button>
              </>
            ) : (
              <>
                <Typography variant="h6" color="error" gutterBottom>Purchase Failed</Typography>
                <Typography color="text.secondary">{result.error}</Typography>
                <Button variant="outlined" sx={{ mt: 2 }} onClick={() => setStep(2)}>
                  Back to Review
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
