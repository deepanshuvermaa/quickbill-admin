import { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  RotateCcw,
  FileText,
  Calculator,
  Receipt,
  Info,
  DollarSign
} from 'lucide-react';
import { useSettingsStore } from '../store';
import toast from 'react-hot-toast';

function BillPrintSettings() {
  const settingsState = useSettingsStore();
  
  // Default print settings
  const defaultSettings = {
    // Item Info Section - New format
    printItemName: true, // Always show
    printHSNCode: false,
    printQuantity: true,
    printRate: true,
    printTaxItemWise: false,
    printDiscountItemWise: false,
    printTotalItemWise: true,
    printRemark: false,
    
    // Legacy Item Info (kept for compatibility)
    printItemSerialNo: false,
    printBarcode: false,
    printFullName: false,
    printBrandName: false,
    printItemSize: false,
    printGSTCategory: false,
    printMRP: false,
    printPrice: true,
    printItemDiscount: false,
    printItemDiscountPercent: false,
    printTaxRateItemWise: false,
    printTaxableAmountItemWise: false,
    
    // Total Info Section
    printTotalTaxSummary: false,
    printSaving: true,
    printSavingAsPercentage: false,
    printRoundOff: false,
    printTotal: true,
    printManualDiscount: false,
    printPaymentMethod: false,
    printNotes: true,
    printOrderInfo: false,
    
    // Tax Breakup Section
    printGSTTaxBreakup: false,
    printGSTHSNBreakup: false,
    
    // Footer Section
    printTermsAndCondition: false,
    printUPIQR: true,
    
    // Additional Settings
    printTaxSummaryInBill: true, // New setting for tax summary between subtotal and total
    billWiseReportSpacing: 'normal', // normal, compact, spacious
    preventDuplicatePhones: true
  };

  const [localSettings, setLocalSettings] = useState(() => {
    const saved = localStorage.getItem('billPrintSettings');
    if (saved) {
      return { ...defaultSettings, ...JSON.parse(saved) };
    }
    return defaultSettings;
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Check if settings have changed from saved version
    const saved = localStorage.getItem('billPrintSettings');
    if (saved) {
      const savedSettings = JSON.parse(saved);
      const changed = JSON.stringify(savedSettings) !== JSON.stringify(localSettings);
      setHasChanges(changed);
    } else {
      setHasChanges(JSON.stringify(defaultSettings) !== JSON.stringify(localSettings));
    }
  }, [localSettings]);

  const handleToggle = (key) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectChange = (key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSettings = () => {
    localStorage.setItem('billPrintSettings', JSON.stringify(localSettings));
    
    // Also update in the global settings store if needed
    settingsState.updateBillPrintSettings?.(localSettings);
    
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('billPrintSettingsUpdated', { 
      detail: localSettings 
    }));
    
    toast.success('Bill print settings saved successfully');
    setHasChanges(false);
  };

  const resetToDefaults = () => {
    if (confirm('Reset all settings to defaults?')) {
      setLocalSettings(defaultSettings);
      toast.info('Settings reset to defaults');
    }
  };

  const ToggleSwitch = ({ enabled, onChange, label }) => (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <button
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <Receipt className="mr-2" size={24} />
            Bill Print Settings
          </h2>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                You have unsaved changes
              </span>
            )}
            <button
              onClick={resetToDefaults}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center"
            >
              <RotateCcw size={18} className="mr-2" />
              Reset
            </button>
            <button
              onClick={saveSettings}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
            >
              <Save size={18} className="mr-2" />
              Save Settings
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Info className="text-blue-500 dark:text-blue-400 mt-1" size={20} />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Customize Your Bill Format</p>
              <p>
                Control what information appears on your printed bills. Enable or disable 
                specific fields to match your business requirements. These settings apply 
                to all bill prints including thermal printer receipts and PDF exports.
              </p>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Item Info Section */}
          <div className="border dark:border-gray-700 rounded-lg">
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <FileText className="mr-2" size={20} />
                Bill Item Columns
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select columns to display. If more than 4 columns are selected, items will be displayed in 2-line format
              </p>
            </div>
            <div className="divide-y dark:divide-gray-700">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-semibold mb-2">
                  Primary Columns (Line 1):
                </p>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600 dark:text-gray-400 italic">
                    • ITEM - Always shown
                  </div>
                  <ToggleSwitch
                    enabled={localSettings.printHSNCode}
                    onChange={() => handleToggle('printHSNCode')}
                    label="HSN Code"
                  />
                  <ToggleSwitch
                    enabled={localSettings.printQuantity}
                    onChange={() => handleToggle('printQuantity')}
                    label="Quantity (QTY)"
                  />
                  <ToggleSwitch
                    enabled={localSettings.printRate}
                    onChange={() => handleToggle('printRate')}
                    label="Rate"
                  />
                </div>
              </div>
              
              <div className="p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mb-2">
                  Secondary Columns (Line 2 if needed):
                </p>
                <div className="space-y-2">
                  <ToggleSwitch
                    enabled={localSettings.printTaxItemWise}
                    onChange={() => handleToggle('printTaxItemWise')}
                    label="Tax Amount"
                  />
                  <ToggleSwitch
                    enabled={localSettings.printDiscountItemWise}
                    onChange={() => handleToggle('printDiscountItemWise')}
                    label="Discount (DISC)"
                  />
                  <ToggleSwitch
                    enabled={localSettings.printTotalItemWise}
                    onChange={() => handleToggle('printTotalItemWise')}
                    label="Total"
                  />
                  <ToggleSwitch
                    enabled={localSettings.printRemark}
                    onChange={() => handleToggle('printRemark')}
                    label="Remark/Note"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50">
                <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mb-2">
                  Additional Item Info:
                </p>
                <div className="space-y-2">
                  <ToggleSwitch
                    enabled={localSettings.printItemSerialNo}
                    onChange={() => handleToggle('printItemSerialNo')}
                    label="Serial Number"
                  />
                  <ToggleSwitch
                    enabled={localSettings.printBarcode}
                    onChange={() => handleToggle('printBarcode')}
                    label="Barcode"
                  />
                  <ToggleSwitch
                    enabled={localSettings.printBrandName}
                    onChange={() => handleToggle('printBrandName')}
                    label="Brand Name"
                  />
                  <ToggleSwitch
                    enabled={localSettings.printMRP}
                    onChange={() => handleToggle('printMRP')}
                    label="MRP (if different from Rate)"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Total Info Section */}
          <div className="border dark:border-gray-700 rounded-lg">
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Calculator className="mr-2" size={20} />
                Total Info
              </h3>
            </div>
            <div className="divide-y dark:divide-gray-700">
              <ToggleSwitch
                enabled={localSettings.printTotalTaxSummary}
                onChange={() => handleToggle('printTotalTaxSummary')}
                label="Print Total Tax Summary"
              />
              <ToggleSwitch
                enabled={localSettings.printTaxSummaryInBill}
                onChange={() => handleToggle('printTaxSummaryInBill')}
                label="Print Tax Breakdown Between Subtotal & Total"
              />
              <ToggleSwitch
                enabled={localSettings.printSaving}
                onChange={() => handleToggle('printSaving')}
                label="Print Saving"
              />
              <ToggleSwitch
                enabled={localSettings.printSavingAsPercentage}
                onChange={() => handleToggle('printSavingAsPercentage')}
                label="Print Saving as Percentage"
              />
              <ToggleSwitch
                enabled={localSettings.printRoundOff}
                onChange={() => handleToggle('printRoundOff')}
                label="Print Round Off"
              />
              <ToggleSwitch
                enabled={localSettings.printTotal}
                onChange={() => handleToggle('printTotal')}
                label="Print Total"
              />
              <ToggleSwitch
                enabled={localSettings.printManualDiscount}
                onChange={() => handleToggle('printManualDiscount')}
                label="Print Manual Discount"
              />
              <ToggleSwitch
                enabled={localSettings.printPaymentMethod}
                onChange={() => handleToggle('printPaymentMethod')}
                label="Print Payment Method"
              />
              <ToggleSwitch
                enabled={localSettings.printNotes}
                onChange={() => handleToggle('printNotes')}
                label="Print Notes"
              />
              <ToggleSwitch
                enabled={localSettings.printOrderInfo}
                onChange={() => handleToggle('printOrderInfo')}
                label="Print Order Info"
              />
            </div>
          </div>

          {/* Tax Breakup Section */}
          <div className="border dark:border-gray-700 rounded-lg">
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <DollarSign className="mr-2" size={20} />
                Tax Breakup
              </h3>
            </div>
            <div className="divide-y dark:divide-gray-700">
              <ToggleSwitch
                enabled={localSettings.printGSTTaxBreakup}
                onChange={() => handleToggle('printGSTTaxBreakup')}
                label="Print GST Tax Breakup"
              />
              <ToggleSwitch
                enabled={localSettings.printGSTHSNBreakup}
                onChange={() => handleToggle('printGSTHSNBreakup')}
                label="Print GST HSN Breakup"
              />
            </div>
          </div>

          {/* Footer Section */}
          <div className="border dark:border-gray-700 rounded-lg">
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Footer
              </h3>
            </div>
            <div className="divide-y dark:divide-gray-700">
              <ToggleSwitch
                enabled={localSettings.printTermsAndCondition}
                onChange={() => handleToggle('printTermsAndCondition')}
                label="Print Terms & Conditions"
              />
              <ToggleSwitch
                enabled={localSettings.printUPIQR}
                onChange={() => handleToggle('printUPIQR')}
                label="Print UPI QR"
              />
            </div>
          </div>

          {/* Report Settings */}
          <div className="border dark:border-gray-700 rounded-lg">
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Report Settings
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bill-wise Report Line Spacing
                </label>
                <select
                  value={localSettings.billWiseReportSpacing}
                  onChange={(e) => handleSelectChange('billWiseReportSpacing', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="spacious">Spacious</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Adjust line spacing in bill-wise sales reports to prevent overlap
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BillPrintSettings;