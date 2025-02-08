// server.js
const express = require('express');
const cors = require('cors');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');

const usb = require('usb');
console.log(usb);

const app = express();
const PORT = process.env.PORT || 5058;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Printer check endpoint
app.get('/check-printer', async (req, res) => {
  try {
    const devices = escpos.USB.findPrinter();
    
    if (devices.length === 0) {
      return res.status(404).json({ 
        error: 'No printer found. Please connect a printer.' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Printer found',
      printerCount: devices.length
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error checking printer status',
      details: error.message 
    });
  }
});

// Print receipt endpoint
app.post('/print-receipt', async (req, res) => {
  try {
    const {
      shopName,
      orderId,
      customerName,
      customerPhone,
      orderDate,
      items,
      total,
      footer,
      orderNumber
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items)) {
      throw new Error('Invalid items array');
    }

    // Find first available USB printer
    const device = new escpos.USB();
    
    // Create printer instance
    const printer = new escpos.Printer(device);

    // Print receipt
    device.open(function(error) {
      if (error) {
        throw new Error('Error opening printer: ' + error.message);
      }

      try {
        printer
          .font('a')
          .align('ct')
          .style('b')
          .size(1, 1)
          .text(shopName || 'Shop Receipt')
          .text('Order #' + (orderNumber || orderId))
          .text(orderDate || new Date().toLocaleString())
          .text('\n')
          .align('lt')
          .text('Customer: ' + (customerName || 'Guest'))
          .text('Phone: ' + (customerPhone || 'N/A'))
          .text('\n')
          .tableCustom([
            { text: 'Item', width: 0.4 },
            { text: 'Qty', width: 0.2 },
            { text: 'Price', width: 0.2 },
            { text: 'Total', width: 0.2 }
          ])
          .text('-'.repeat(48));

        // Print items
        items.forEach(item => {
          printer.tableCustom([
            { text: item.name.substring(0, 20), width: 0.4 }, // Limit name length
            { text: item.quantity.toString(), width: 0.2 },
            { text: item.price.toFixed(2), width: 0.2 },
            { text: (item.price * item.quantity).toFixed(2), width: 0.2 }
          ]);
        });

        printer
          .text('-'.repeat(48))
          .align('rt')
          .text('Total: Rs.' + (total || '0.00').toFixed(2))
          .text('\n')
          .align('ct')
          .text(footer || 'Thank you for your business!')
          .text('\n')
          .text(new Date().toLocaleString())
          .cut()
          .close();

        res.json({ 
          success: true, 
          message: 'Receipt printed successfully' 
        });
      } catch (printError) {
        throw new Error('Error during printing: ' + printError.message);
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error printing receipt',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something broke!',
    details: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Printer endpoint available at http://localhost:${PORT}/print-receipt`);
  console.log(`Printer check endpoint available at http://localhost:${PORT}/check-printer`);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully');
  process.exit(0);
});