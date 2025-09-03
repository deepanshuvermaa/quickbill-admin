// New Bill Formatter with Smart Two-Line Layout
import { formatCurrency } from './currency';

class BillFormatterNew {
  constructor(config = {}) {
    this.paperSize = config.paperSize || '80mm';
    this.fontSize = config.fontSize || 'medium';
    this.businessInfo = config.businessInfo || {};
    this.printerSettings = config.printerSettings || {};
  }

  // Calculate column widths based on paper size and columns selected
  getColumnWidths(columns, paperSize) {
    const totalColumns = columns.length;
    const is58mm = paperSize === '58mm';
    
    // Base widths for different paper sizes
    const widths = {
      item: is58mm ? '35%' : '30%',
      hsn: is58mm ? '15%' : '12%',
      qty: is58mm ? '12%' : '10%',
      rate: is58mm ? '18%' : '15%',
      tax: is58mm ? '15%' : '12%',
      disc: is58mm ? '15%' : '12%',
      total: is58mm ? '20%' : '18%',
      remark: is58mm ? '25%' : '20%'
    };

    // Adjust widths if fewer columns
    if (totalColumns <= 4) {
      const factor = 100 / totalColumns;
      Object.keys(widths).forEach(key => {
        widths[key] = `${factor}%`;
      });
    }

    return widths;
  }

  // Format item name based on available space
  formatItemName(name, maxLength = 20) {
    if (!name) return '';
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 2) + '..';
  }

  // Generate bill HTML with new format
  generateBillHTML(bill) {
    const fontConfig = this.getFontConfig();
    const paperWidth = this.getPaperWidth();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bill ${bill.billNumber}</title>
        <style>
          @media print {
            @page {
              size: ${paperWidth} auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          
          body {
            font-family: 'Courier New', monospace;
            width: ${paperWidth};
            margin: 0 auto;
            padding: 5px;
            font-size: ${fontConfig.base};
            line-height: 1.2;
            font-weight: bold;
          }
          
          .header {
            text-align: center;
            font-size: ${fontConfig.header};
            font-weight: bold;
            margin-bottom: 3px;
          }
          
          .sub-header {
            text-align: center;
            font-size: ${fontConfig.footer};
            margin-bottom: 2px;
            font-weight: bold;
          }
          
          .title {
            font-size: ${fontConfig.title};
            font-weight: bold;
            text-align: center;
            margin: 5px 0;
          }
          
          .separator {
            border-top: 1px dashed #000;
            margin: 4px 0;
          }
          
          .double-separator {
            border-top: 2px solid #000;
            margin: 4px 0;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
          }
          
          th {
            font-weight: bold;
            text-align: left;
            padding: 2px;
            font-size: ${fontConfig.body};
            border-bottom: 1px solid #000;
          }
          
          td {
            padding: 1px 2px;
            font-size: ${fontConfig.body};
            vertical-align: top;
          }
          
          .item-row-separator {
            border-bottom: 1px dotted #ccc;
            margin: 2px 0;
          }
          
          .text-right {
            text-align: right;
          }
          
          .text-center {
            text-align: center;
          }
          
          .text-small {
            font-size: ${fontConfig.footer};
          }
          
          .bold {
            font-weight: bold;
          }
          
          .total-section {
            margin-top: 5px;
            font-size: ${fontConfig.title};
            font-weight: bold;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
            font-weight: bold;
          }
          
          .footer {
            text-align: center;
            margin-top: 8px;
            font-size: ${fontConfig.footer};
            font-weight: bold;
          }
          
          .tax-box {
            background: #f5f5f5;
            border: 1px solid #ddd;
            padding: 3px;
            margin: 3px 0;
            font-size: ${fontConfig.footer};
            font-weight: bold;
          }
          
          /* Two-line item format */
          .item-line1 {
            display: flex;
            justify-content: space-between;
            font-size: ${fontConfig.body};
          }
          
          .item-line2 {
            display: flex;
            justify-content: space-between;
            font-size: ${fontConfig.footer};
            padding-left: 10px;
            color: #555;
          }
        </style>
      </head>
      <body>
        ${this.generateBillContent(bill)}
      </body>
      </html>
    `;
  }

  // Generate bill content with smart layout
  generateBillContent(bill) {
    const businessInfo = this.businessInfo;
    const items = bill.items || [];
    
    // Get print settings
    const settings = JSON.parse(localStorage.getItem('billPrintSettings') || '{}');
    const printSettings = {
      printHSNCode: settings.printHSNCode || false,
      printQuantity: settings.printQuantity !== false,
      printRate: settings.printRate !== false,
      printTaxItemWise: settings.printTaxItemWise || false,
      printDiscountItemWise: settings.printDiscountItemWise || false,
      printTotalItemWise: settings.printTotalItemWise !== false,
      printRemark: settings.printRemark || false,
      ...settings
    };

    // Count active columns
    let activeColumns = ['item']; // Item is always shown
    if (printSettings.printHSNCode) activeColumns.push('hsn');
    if (printSettings.printQuantity) activeColumns.push('qty');
    if (printSettings.printRate) activeColumns.push('rate');
    if (printSettings.printTaxItemWise) activeColumns.push('tax');
    if (printSettings.printDiscountItemWise) activeColumns.push('disc');
    if (printSettings.printTotalItemWise) activeColumns.push('total');
    if (printSettings.printRemark) activeColumns.push('remark');

    // Determine if we need two-line format
    const useTwoLineFormat = activeColumns.length > 4;
    
    // Split columns for two-line format
    let line1Columns = ['item'];
    let line2Columns = [];
    
    if (useTwoLineFormat) {
      // Line 1: ITEM, HSN, QTY, RATE
      if (printSettings.printHSNCode) line1Columns.push('hsn');
      if (printSettings.printQuantity) line1Columns.push('qty');
      if (printSettings.printRate) line1Columns.push('rate');
      
      // Line 2: TAX, DISC, TOTAL, REMARK
      if (printSettings.printTaxItemWise) line2Columns.push('tax');
      if (printSettings.printDiscountItemWise) line2Columns.push('disc');
      if (printSettings.printTotalItemWise) line2Columns.push('total');
      if (printSettings.printRemark) line2Columns.push('remark');
    } else {
      line1Columns = activeColumns;
    }

    // Start building content
    let content = `
      <div class="header">${businessInfo.name || 'Super QuickBill POS'}</div>
      ${businessInfo.address ? `<div class="sub-header">${businessInfo.address}</div>` : ''}
      ${businessInfo.phone ? `<div class="sub-header">Tel: ${businessInfo.phone}</div>` : ''}
      ${businessInfo.gstNumber ? `<div class="sub-header">GST: ${businessInfo.gstNumber}</div>` : ''}
      
      <div class="separator"></div>
      
      <div class="title">BILL: ${bill.billNumber.replace('BILL-', '')}</div>
      <div style="font-size: 10px;">
        <div>Date: ${new Date(bill.createdAt).toLocaleString('en-IN')}</div>
        ${bill.customerName ? `<div>Customer: ${bill.customerName}</div>` : ''}
        ${bill.customerPhone ? `<div>Phone: ${bill.customerPhone}</div>` : ''}
        ${bill.tableNumber ? `<div>Table: ${bill.tableNumber}</div>` : ''}
      </div>
      
      <div class="separator"></div>
    `;

    // Build item table
    if (useTwoLineFormat) {
      // Two-line format
      content += this.generateTwoLineItemTable(items, line1Columns, line2Columns, bill, printSettings);
    } else {
      // Single-line format
      content += this.generateSingleLineItemTable(items, line1Columns, bill, printSettings);
    }

    // Add totals section
    content += this.generateTotalsSection(bill, printSettings);
    
    // Add footer
    content += this.generateFooterSection(bill, printSettings, businessInfo);

    return content;
  }

  // Generate single-line item table
  generateSingleLineItemTable(items, columns, bill, printSettings) {
    let content = '<table><thead><tr>';
    
    // Get font config for dynamic sizing
    const fontConfig = this.getFontConfig();
    const fontSize = fontConfig.rawSize || 11;
    
    // Add headers with adjusted alignment and bold font
    columns.forEach(col => {
      switch(col) {
        case 'item': content += `<th style="width: 40%; text-align: left; font-weight: bold; font-size: ${fontSize}px;">ITEM</th>`; break;
        case 'hsn': content += `<th style="width: 15%; text-align: left; padding-left: 0; font-weight: bold; font-size: ${fontSize}px;">HSN</th>`; break;
        case 'qty': content += `<th style="width: 10%; text-align: left; padding-left: 0; font-weight: bold; font-size: ${fontSize}px;">QTY</th>`; break;
        case 'rate': content += `<th style="width: 15%; text-align: right; padding-right: 10px; font-weight: bold; font-size: ${fontSize}px;">RATE</th>`; break;
        case 'tax': content += `<th style="width: 12%; text-align: right; font-weight: bold; font-size: ${fontSize}px;">TAX</th>`; break;
        case 'disc': content += `<th style="width: 12%; text-align: right; font-weight: bold; font-size: ${fontSize}px;">DISC</th>`; break;
        case 'total': content += `<th style="width: 20%; text-align: right; padding-right: 10px; font-weight: bold; font-size: ${fontSize}px;">TOTAL</th>`; break;
        case 'remark': content += `<th style="width: 20%; text-align: left; font-weight: bold; font-size: ${fontSize}px;">NOTE</th>`; break;
      }
    });
    
    content += '</tr></thead><tbody>';
    
    // Add item rows
    items.forEach((item, index) => {
      const qty = item.quantity || 1;
      const rate = item.price || 0;
      // Use item's tax rate if available, otherwise use bill's tax rate or default from settings
      const taxRate = item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : (bill.taxRate || 0);
      const baseAmount = rate * qty;
      const discountPercent = item.discount || 0;
      const discountAmount = (baseAmount * discountPercent) / 100;
      const taxableAmount = baseAmount - discountAmount;
      const taxAmount = (taxableAmount * taxRate) / 100;
      const total = taxableAmount + taxAmount;
      
      content += '<tr>';
      
      columns.forEach(col => {
        const fontSize = fontConfig.rawSize || 11;
        switch(col) {
          case 'item': 
            content += `<td style="font-weight: bold; font-size: ${fontSize}px;">${this.formatItemName(item.name, 25)}</td>`; 
            break;
          case 'hsn': 
            content += `<td style="font-weight: bold; font-size: ${fontSize}px; padding-left: 0;">${item.hsnCode || '-'}</td>`; 
            break;
          case 'qty': 
            content += `<td style="text-align: left; font-weight: bold; font-size: ${fontSize}px; padding-left: 0;">${qty}</td>`; 
            break;
          case 'rate': 
            content += `<td style="text-align: right; font-weight: bold; font-size: ${fontSize}px; padding-right: 10px;">${formatCurrency(rate)}</td>`; 
            break;
          case 'tax': 
            content += `<td style="text-align: right; font-weight: bold; font-size: ${fontSize}px;">${formatCurrency(taxAmount)}</td>`; 
            break;
          case 'disc': 
            content += `<td style="text-align: right; font-weight: bold; font-size: ${fontSize}px;">${discount > 0 ? formatCurrency(discountAmount) : '-'}</td>`; 
            break;
          case 'total': 
            content += `<td style="text-align: right; font-weight: bold; font-size: ${fontSize}px; padding-right: 10px;">${formatCurrency(total)}</td>`; 
            break;
          case 'remark': 
            content += `<td style="font-weight: bold; font-size: ${fontSize}px;">${item.remark || '-'}</td>`; 
            break;
        }
      });
      
      content += '</tr>';
      
      // Add 12px spacing between items
      if (index < items.length - 1) {
        content += '<tr><td colspan="' + columns.length + '" style="height: 12px; border: none;"></td></tr>';
      }
    });
    
    content += '</tbody></table>';
    return content;
  }

  // Generate two-line item table
  generateTwoLineItemTable(items, line1Columns, line2Columns, bill, printSettings) {
    let content = '';
    
    // Get font config for dynamic sizing
    const fontConfig = this.getFontConfig();
    const fontSize = fontConfig.rawSize || 11;
    
    // Primary header row
    content += '<div style="border-bottom: 2px solid #000; padding-bottom: 2px; margin-bottom: 3px;">';
    content += '<table style="width: 100%; border-collapse: collapse; table-layout: fixed;">';
    content += '<tr>';
    
    // Calculate column widths based on what's enabled
    const hasHSN = line1Columns.includes('hsn');
    const hasQty = line1Columns.includes('qty'); 
    const hasRate = line1Columns.includes('rate');
    
    // Set column widths - adjusted for better alignment
    let itemWidth = '40%';
    let hsnWidth = '20%';
    let qtyWidth = '20%';  // Increased from 15%
    let rateWidth = '20%';  // Decreased from 25%
    
    // When only 4 columns (no HSN), redistribute space
    if (!hasHSN) {
      itemWidth = '45%';
      qtyWidth = '25%';
      rateWidth = '30%';
    }
    
    // ITEM column - always present
    content += `<th style="width: ${itemWidth}; text-align: left; font-weight: bold; font-size: ${fontSize}px; color: #000; padding: 2px 0;">ITEM</th>`;
    
    // Other primary columns with adjusted alignment - shifted 10px left
    if (hasHSN) {
      content += `<th style="width: ${hsnWidth}; text-align: left; font-weight: bold; font-size: ${fontSize}px; color: #000; padding: 2px 0; padding-left: 0;">HSN</th>`;
    }
    if (hasQty) {
      content += `<th style="width: ${qtyWidth}; text-align: left; font-weight: bold; font-size: ${fontSize}px; color: #000; padding: 2px 0; padding-left: 0;">QTY</th>`;
    }
    if (hasRate) {
      content += `<th style="width: ${rateWidth}; text-align: right; font-weight: bold; font-size: ${fontSize}px; color: #000; padding: 2px 0; padding-right: 10px;">RATE</th>`;
    }
    
    content += '</tr></table></div>';
    
    // Add items in two-section format
    items.forEach((item, index) => {
      const qty = item.quantity || 1;
      const rate = item.price || 0;
      // Use item's tax rate if available, otherwise use bill's tax rate or default from settings  
      const taxRate = item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : (bill.taxRate || 0);
      const baseAmount = rate * qty;
      const discountPercent = item.discount || 0;
      const discountAmount = (baseAmount * discountPercent) / 100;
      const taxableAmount = baseAmount - discountAmount;
      const taxAmount = (taxableAmount * taxRate) / 100;
      const total = taxableAmount + taxAmount;
      
      // Line 1 - Primary data
      content += '<table style="width: 100%; border-collapse: collapse; table-layout: fixed;">';
      content += '<tr>';
      
      // Match the header column widths
      let itemWidth = '40%';
      let hsnWidth = '20%';
      let qtyWidth = '20%';
      let rateWidth = '20%';
      
      if (!hasHSN) {
        itemWidth = '45%';
        qtyWidth = '25%';
        rateWidth = '30%';
      }
      
      // ITEM column with bold font
      content += `<td style="width: ${itemWidth}; text-align: left; font-size: ${fontSize}px; font-weight: bold; padding: 1px 0;">
        ${printSettings.printItemSerialNo ? `${index + 1}. ` : ''}${this.formatItemName(item.name, 25)}
      </td>`;
      
      // Other primary columns with adjusted alignment and bold font - shifted 10px left
      if (hasHSN) {
        content += `<td style="width: ${hsnWidth}; text-align: left; font-size: ${fontSize}px; font-weight: bold; padding: 1px 0; padding-left: 0;">${item.hsnCode || '-'}</td>`;
      }
      if (hasQty) {
        content += `<td style="width: ${qtyWidth}; text-align: left; font-size: ${fontSize}px; font-weight: bold; padding: 1px 0; padding-left: 0;">${qty}</td>`;
      }
      if (hasRate) {
        content += `<td style="width: ${rateWidth}; text-align: right; font-size: ${fontSize}px; font-weight: bold; padding: 1px 0; padding-right: 10px;">${formatCurrency(rate)}</td>`;
      }
      
      content += '</tr>';
      content += '</table>';
      
      // Line 2 - Secondary section with headers and values (if there are secondary columns)
      if (line2Columns.length > 0) {
        content += '<div style="margin-top: 2px; margin-bottom: 4px;">';
        content += '<table style="width: 100%; border-collapse: collapse;">';
        
        // Secondary headers row
        content += '<tr>';
        if (line2Columns.includes('tax')) {
          content += `<th style="text-align: left; font-weight: bold; font-size: ${fontSize}px; color: #000; padding: 1px 0;">Tax</th>`;
        }
        if (line2Columns.includes('disc')) {
          content += `<th style="text-align: center; font-weight: bold; font-size: ${fontSize}px; color: #000; padding: 1px 0;">Disc</th>`;
        }
        if (line2Columns.includes('total')) {
          content += `<th style="text-align: right; font-weight: bold; font-size: ${fontSize}px; color: #000; padding: 1px 0;">Amt</th>`;
        }
        if (line2Columns.includes('remark')) {
          content += `<th style="text-align: left; font-weight: bold; font-size: ${fontSize}px; color: #000; padding: 1px 0;">Note</th>`;
        }
        content += '</tr>';
        
        // Secondary values row with bold font
        content += '<tr>';
        if (line2Columns.includes('tax')) {
          content += `<td style="text-align: left; font-size: ${fontSize}px; font-weight: bold; padding: 1px 0; padding-left: 0;">${formatCurrency(taxAmount)}</td>`;
        }
        if (line2Columns.includes('disc')) {
          const discDisplay = discountAmount > 0 ? formatCurrency(discountAmount) : '-';
          content += `<td style="text-align: center; font-size: ${fontSize}px; font-weight: bold; padding: 1px 0;">${discDisplay}</td>`;
        }
        if (line2Columns.includes('total')) {
          content += `<td style="text-align: right; font-size: ${fontSize}px; font-weight: bold; padding: 1px 0; padding-right: 10px;">${formatCurrency(total)}</td>`;
        }
        if (line2Columns.includes('remark')) {
          content += `<td style="text-align: left; font-size: ${fontSize}px; font-weight: bold; padding: 1px 0; font-style: italic;">${item.remark || ''}</td>`;
        }
        content += '</tr>';
        
        content += '</table>';
        content += '</div>';
      }
      
      // Add 12px spacing between items
      if (index < items.length - 1) {
        content += '<div style="height: 12px;"></div>';
      }
    });
    
    return content;
  }

  // Generate totals section
  generateTotalsSection(bill, printSettings) {
    let content = '<div class="separator"></div><div>';
    
    // Calculate accurate totals
    let subtotal = 0;
    let totalTaxAmount = 0;
    let totalDiscountAmount = 0;
    let taxBreakdown = {};
    
    // Calculate from items
    bill.items?.forEach(item => {
      const qty = item.quantity || 1;
      const rate = item.price || 0;
      const baseAmount = rate * qty;
      subtotal += baseAmount;
      
      // Item-level discount
      const itemDiscountPercent = item.discount || 0;
      const itemDiscountAmount = (baseAmount * itemDiscountPercent) / 100;
      totalDiscountAmount += itemDiscountAmount;
      
      // Tax calculation on discounted amount
      const itemTaxRate = item.taxRate !== undefined && item.taxRate !== null ? item.taxRate : (bill.taxRate || 0);
      const taxableAmount = baseAmount - itemDiscountAmount;
      const itemTaxAmount = (taxableAmount * itemTaxRate) / 100;
      totalTaxAmount += itemTaxAmount;
      
      // Group by tax rate for breakdown
      if (itemTaxRate > 0) {
        if (!taxBreakdown[itemTaxRate]) {
          taxBreakdown[itemTaxRate] = { taxable: 0, tax: 0 };
        }
        taxBreakdown[itemTaxRate].taxable += taxableAmount;
        taxBreakdown[itemTaxRate].tax += itemTaxAmount;
      }
    });
    
    // Bill-level discount (if any)
    const billDiscountPercent = bill.discount || 0;
    const billDiscountAmount = billDiscountPercent > 0 ? (subtotal * billDiscountPercent) / 100 : 0;
    
    // Show subtotal
    content += `
      <div class="info-row">
        <span>Subtotal:</span>
        <span style="padding-right: 20px;">${formatCurrency(subtotal)}</span>
      </div>
    `;
    
    // Show discounts
    if ((totalDiscountAmount > 0 || billDiscountAmount > 0) && printSettings.printManualDiscount !== false) {
      if (totalDiscountAmount > 0) {
        content += `
          <div class="info-row">
            <span>Item Discounts:</span>
            <span style="padding-right: 20px;">-${formatCurrency(totalDiscountAmount)}</span>
          </div>
        `;
      }
      if (billDiscountAmount > 0) {
        content += `
          <div class="info-row">
            <span>Bill Discount (${billDiscountPercent}%):</span>
            <span style="padding-right: 20px;">-${formatCurrency(billDiscountAmount)}</span>
          </div>
        `;
      }
    }
    
    // Tax breakdown
    if (printSettings.printTaxSummaryInBill) {
      const taxRates = Object.keys(taxBreakdown);
      
      if (taxRates.length > 0 && totalTaxAmount > 0) {
        content += '<div class="tax-box"><div class="bold" style="font-weight: bold;">Tax Breakdown:</div>';
        
        // Show tax breakdown by rate
        Object.entries(taxBreakdown).forEach(([rate, data]) => {
          const taxRate = parseFloat(rate);
          if (taxRate > 0) {
            // For GST, split into CGST/SGST
            const cgst = taxRate / 2;
            const sgst = taxRate / 2;
            const cgstAmount = data.tax / 2;
            const sgstAmount = data.tax / 2;
            
            content += `
              <div class="info-row" style="font-weight: bold; margin-bottom: 8px;">
                <span style="font-weight: bold;">Tax @ ${taxRate}%:</span>
                <span style="padding-right: 20px; font-weight: bold;">${formatCurrency(data.tax)}</span>
              </div>
            `;
            
            if (taxRate === 5 || taxRate === 12 || taxRate === 18 || taxRate === 28) {
              content += `
                <div class="info-row" style="font-size: 9px; padding-left: 10px; font-weight: bold; margin-bottom: 8px;">
                  <span style="font-weight: bold;">CGST @ ${cgst}%:</span>
                  <span style="padding-right: 20px; font-weight: bold;">${formatCurrency(cgstAmount)}</span>
                </div>
                <div class="info-row" style="font-size: 9px; padding-left: 10px; font-weight: bold; margin-bottom: 8px;">
                  <span style="font-weight: bold;">SGST @ ${sgst}%:</span>
                  <span style="padding-right: 20px; font-weight: bold;">${formatCurrency(sgstAmount)}</span>
                </div>
              `;
            }
          }
        });
        
        content += `
          <div class="info-row bold" style="font-weight: bold; margin-top: 8px;">
            <span style="font-weight: bold;">Total Tax:</span>
            <span style="padding-right: 20px; font-weight: bold;">${formatCurrency(totalTaxAmount)}</span>
          </div>
        </div>`;
      }
    } else if (totalTaxAmount > 0) {
      // Show simple tax line if tax breakdown is disabled
      content += `
        <div class="info-row" style="font-weight: bold;">
          <span style="font-weight: bold;">Tax:</span>
          <span style="font-weight: bold; padding-right: 20px;">${formatCurrency(totalTaxAmount)}</span>
        </div>
      `;
    }
    
    // Calculate grand total
    const grandTotal = subtotal - totalDiscountAmount - billDiscountAmount + totalTaxAmount;
    
    // Total
    if (printSettings.printTotal) {
      content += `
        <div class="double-separator"></div>
        <div class="total-section">
          <div class="info-row">
            <span>TOTAL:</span>
            <span style="padding-right: 20px;">${formatCurrency(grandTotal)}</span>
          </div>
        </div>
      `;
    }
    
    // Payment method
    if (printSettings.printPaymentMethod) {
      content += `
        <div class="info-row" style="font-weight: bold;">
          <span style="font-weight: bold;">Payment:</span>
          <span style="font-weight: bold;">${bill.paymentMethod?.toUpperCase() || 'CASH'}</span>
        </div>
      `;
    }
    
    content += '</div>';
    return content;
  }

  // Generate footer section
  generateFooterSection(bill, printSettings, businessInfo) {
    let content = '<div class="separator"></div><div class="footer">';
    
    // Terms and conditions
    if (printSettings.printTermsAndCondition && businessInfo.termsAndConditions) {
      content += `
        <div class="text-small" style="margin: 5px 0;">
          ${businessInfo.termsAndConditions}
        </div>
      `;
    }
    
    // UPI
    if (printSettings.printUPIQR && businessInfo.upiId) {
      content += `
        <div style="margin: 3px 0;">
          <strong>UPI:</strong> ${businessInfo.upiId}
        </div>
      `;
    }
    
    content += `
      <div style="font-weight: bold;">Thank you for your business!</div>
      <div style="font-weight: bold;">Powered by Super QuickBill</div>
    </div>`;
    
    return content;
  }

  // Get font configuration based on settings
  getFontConfig() {
    // Always read fresh settings from localStorage to ensure we have the latest
    const savedSettings = JSON.parse(localStorage.getItem('printerSettings') || '{}');
    const customSizes = savedSettings.customFontSizes || this.printerSettings?.customFontSizes || {};
    
    // Get the bill font size - check saved settings first
    const baseSize = customSizes.bill || 11;
    
    // Parse the base size if it's a string
    const size = typeof baseSize === 'string' ? parseInt(baseSize) || 11 : baseSize;
    
    return {
      base: `${size}px`,
      header: `${size + 3}px`,
      title: `${size + 1}px`,
      body: `${size}px`,
      footer: `${size - 1}px`,
      // Store the raw size for dynamic use
      rawSize: size
    };
  }

  // Get paper width
  getPaperWidth() {
    switch(this.paperSize) {
      case '58mm': return '58mm';
      case '80mm': return '80mm';
      case '112mm': return '112mm';
      default: return '80mm';
    }
  }
}

export default BillFormatterNew;