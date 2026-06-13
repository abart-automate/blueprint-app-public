/* ============================================================
   PARTS LIBRARY
   Seed data, CRUD, page rendering, import/export.
   Depends on: db.js, entity-config.js, state.js, app.js (closeSheet, showToast, confirm, esc)
   ============================================================ */

/* ---- SEED HELPER ---- */
// _s(cat, desc, platform, cardType, ioType, ioPts, voltage, sigRange, isolation, termCnt, rtb, slotInstalled, notes)
function _s(c,d,p,ct,iot,n,v,sr,iso,tc,rtb,si,notes) {
  return {
    catalogNumber:c, manufacturer:'Rockwell Automation', platform:p, description:d,
    cardType:ct, ioType:iot||'N/A', ioPointCount:n||0, voltageLevel:v||'',
    signalRange:sr||'', isolationType:iso||'N/A', terminalCount:tc||0,
    terminalDefinitions:[], rtbType:rtb||'', slotInstalled:si!==false,
    slotWidth:1, backplaneCurrent5V:0, backplaneCurrent24V:0,
    firmwareRevision:'', userManualUrl:'', installGuideUrl:'', notes:notes||'',
  };
}

/* ---- SEED DATA ---- */
const PARTS_LIB_SEED = [

  // ======================================================
  // 1769 CompactLogix
  // ======================================================

  // -- Controllers: 5370 L1 --
  _s('1769-L16ER-BB1B','CompactLogix 5370 L1 Controller, 384KB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Onboard 2-port EtherNet/IP'),
  _s('1769-L18ER-BB1B','CompactLogix 5370 L1 Controller, 512KB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Onboard 2-port EtherNet/IP, 6 AI/2 AO'),
  _s('1769-L18ERM-BB1B','CompactLogix 5370 L1 Motion Controller, 512KB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Motion; onboard 2-port EtherNet/IP, 6 AI/2 AO'),
  _s('1769-L19ER-BB1B','CompactLogix 5370 L1 Controller, 1MB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Onboard 2-port EtherNet/IP, SD card'),

  // -- Controllers: 5370 L2 --
  _s('1769-L24ER-QB1B','CompactLogix 5370 L2 Controller, 750KB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Onboard 2-port EtherNet/IP'),
  _s('1769-L24ER-QBFC1B','CompactLogix 5370 L2 Controller, 750KB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Onboard 2-port EtherNet/IP, combo I/O'),
  _s('1769-L27ERM-QBFC1B','CompactLogix 5370 L2 Motion Controller, 1MB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Motion; onboard 2-port EtherNet/IP'),

  // -- Controllers: 5370 L3 --
  _s('1769-L30ER','CompactLogix 5370 L3 Controller, 1MB','1769','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1769-L30ER-NSE','CompactLogix 5370 L3 Controller, 1MB (No Safety Entry)','1769','Controller','N/A',0,'','','N/A',0,'',true,'NSE variant — no safety task'),
  _s('1769-L30ERM','CompactLogix 5370 L3 Motion Controller, 1MB','1769','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1769-L30ERMS','Compact GuardLogix 5370 L3 Safety+Motion Controller, 1MB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Safety (SIL2/PLe)'),
  _s('1769-L33ER','CompactLogix 5370 L3 Controller, 2MB','1769','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1769-L33ERM','CompactLogix 5370 L3 Motion Controller, 2MB','1769','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1769-L33ERMS','Compact GuardLogix 5370 L3 Safety+Motion Controller, 2MB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Safety (SIL2/PLe)'),
  _s('1769-L36ERM','CompactLogix 5370 L3 Motion Controller, 4MB','1769','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1769-L36ERMS','Compact GuardLogix 5370 L3 Safety+Motion Controller, 4MB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Safety (SIL2/PLe)'),
  _s('1769-L37ERM','CompactLogix 5370 L3 Motion Controller, 8MB','1769','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1769-L37ERMS','Compact GuardLogix 5370 L3 Safety+Motion Controller, 8MB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Safety (SIL2/PLe)'),
  _s('1769-L38ERM','CompactLogix 5370 L3 Motion Controller, 16MB','1769','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1769-L38ERMS','Compact GuardLogix 5370 L3 Safety+Motion Controller, 16MB','1769','Controller','N/A',0,'','','N/A',0,'',true,'Safety (SIL2/PLe)'),

  // -- Controllers: Legacy --
  _s('1769-L20','CompactLogix Legacy Controller','1769','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1769-L30','CompactLogix Legacy Controller','1769','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1769-L31','CompactLogix Legacy Controller','1769','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1769-L32C','CompactLogix Legacy Controller w/ ControlNet','1769','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; onboard ControlNet port; discontinued'),
  _s('1769-L32E','CompactLogix Legacy Controller w/ EtherNet/IP','1769','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1769-L35CR','CompactLogix Legacy Controller w/ ControlNet+Remote I/O','1769','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1769-L35E','CompactLogix Legacy Controller w/ EtherNet/IP','1769','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),

  // -- Digital Input --
  _s('1769-IA8I','8-Point 120V AC Input, Individually Isolated','1769','Digital','Input',8,'120VAC','','Individually-isolated',12,'',true,''),
  _s('1769-IA16','16-Point 120V AC Input','1769','Digital','Input',16,'120VAC','','Non-isolated',20,'',true,''),
  _s('1769-IM12','12-Point 100-240V AC Input (Universal)','1769','Digital','Input',12,'100-240VAC','','Non-isolated',14,'',true,''),
  _s('1769-IG16','16-Point 5V DC TTL Input','1769','Digital','Input',16,'5VDC','','Non-isolated',20,'',true,'TTL logic'),
  _s('1769-IQ16','16-Point 24V DC Source/Sink Input','1769','Digital','Input',16,'24VDC','','Non-isolated',20,'',true,''),
  _s('1769-IQ16F','16-Point 24V DC Fast Input','1769','Digital','Input',16,'24VDC','','Non-isolated',20,'',true,'High-speed; 50µs filter'),
  _s('1769-IQ32','32-Point 24V DC Source/Sink Input','1769','Digital','Input',32,'24VDC','','Non-isolated',36,'',true,''),
  _s('1769-IQ32T','32-Point 24V DC Input with Timestamp','1769','Digital','Input',32,'24VDC','','Non-isolated',36,'',true,'Time-stamped inputs; 1ms resolution'),
  _s('1769-IA16K','16-Point 120V AC Input (Conformal Coated)','1769','Digital','Input',16,'120VAC','','Non-isolated',20,'',true,'Conformal coated'),
  _s('1769-IQ16K','16-Point 24V DC Input (Conformal Coated)','1769','Digital','Input',16,'24VDC','','Non-isolated',20,'',true,'Conformal coated'),
  _s('1769-IQ32K','32-Point 24V DC Input (Conformal Coated)','1769','Digital','Input',32,'24VDC','','Non-isolated',36,'',true,'Conformal coated'),

  // -- Digital Output --
  _s('1769-OA8','8-Point 120/240V AC Output','1769','Digital','Output',8,'120/240VAC','','Non-isolated',12,'',true,''),
  _s('1769-OA16','16-Point 120/240V AC Output','1769','Digital','Output',16,'120/240VAC','','Non-isolated',20,'',true,''),
  _s('1769-OB8','8-Point 24V DC Sourcing Output','1769','Digital','Output',8,'24VDC','','Non-isolated',12,'',true,'0.5A/pt'),
  _s('1769-OB16','16-Point 24V DC Sourcing Output','1769','Digital','Output',16,'24VDC','','Non-isolated',20,'',true,'0.5A/pt'),
  _s('1769-OB16P','16-Point 24V DC Sourcing Output w/ Electronic Fuse','1769','Digital','Output',16,'24VDC','','Non-isolated',20,'',true,'0.5A/pt; per-point e-fuse'),
  _s('1769-OB32','32-Point 24V DC Sourcing Output','1769','Digital','Output',32,'24VDC','','Non-isolated',36,'',true,'0.25A/pt'),
  _s('1769-OB32T','32-Point 24V DC Sourcing Output with Timestamp','1769','Digital','Output',32,'24VDC','','Non-isolated',36,'',true,'Time-stamped'),
  _s('1769-OG16','16-Point 5V DC TTL Output','1769','Digital','Output',16,'5VDC','','Non-isolated',20,'',true,'TTL logic'),
  _s('1769-OV16','16-Point 24V DC Sourcing Output','1769','Digital','Output',16,'24VDC','','Non-isolated',20,'',true,''),
  _s('1769-OV32T','32-Point 24V DC Sourcing Output with Timestamp','1769','Digital','Output',32,'24VDC','','Non-isolated',36,'',true,'Time-stamped'),
  _s('1769-OW8','8-Point Relay NO Output, 5-265V AC/DC','1769','Digital','Output',8,'5-265V AC/DC','','Non-isolated',12,'',true,'Relay; non-isolated'),
  _s('1769-OW8I','8-Point Relay Output, Individually Isolated','1769','Digital','Output',8,'5-265V AC/DC','','Individually-isolated',20,'',true,'Relay; individually isolated'),
  _s('1769-OW16','16-Point Relay NO Output, 5-265V AC/DC','1769','Digital','Output',16,'5-265V AC/DC','','Non-isolated',20,'',true,'Relay; non-isolated'),
  _s('1769-OA16K','16-Point 120/240V AC Output (Conformal Coated)','1769','Digital','Output',16,'120/240VAC','','Non-isolated',20,'',true,'Conformal coated'),
  _s('1769-OB8K','8-Point 24V DC Sourcing Output (Conformal Coated)','1769','Digital','Output',8,'24VDC','','Non-isolated',12,'',true,'Conformal coated'),
  _s('1769-OB16K','16-Point 24V DC Sourcing Output (Conformal Coated)','1769','Digital','Output',16,'24VDC','','Non-isolated',20,'',true,'Conformal coated'),
  _s('1769-OB32K','32-Point 24V DC Sourcing Output (Conformal Coated)','1769','Digital','Output',32,'24VDC','','Non-isolated',36,'',true,'Conformal coated'),

  // -- Analog Input --
  _s('1769-IF4','4-Channel ±10V / 0-20mA Analog Input','1769','Analog','Input',4,'','±10V / 0-20mA','Non-isolated',8,'',true,''),
  _s('1769-IF4I','4-Channel ±10V / 0-20mA Analog Input, Isolated','1769','Analog','Input',4,'','±10V / 0-20mA','Isolated',8,'',true,''),
  _s('1769-IF8','8-Channel ±10V / 0-20mA Analog Input','1769','Analog','Input',8,'','±10V / 0-20mA','Non-isolated',12,'',true,''),
  _s('1769-IF16C','16-Channel Current-Only Analog Input (0/4-20mA)','1769','Analog','Input',16,'','4-20mA','Non-isolated',20,'',true,'Current only'),
  _s('1769-IF16V','16-Channel Voltage-Only Analog Input (±10V / 0-5V / 1-5V)','1769','Analog','Input',16,'','0-10V','Non-isolated',20,'',true,'Voltage only'),
  _s('1769-IR6','6-Channel RTD/Resistance Input, Isolated','1769','Analog','Input',6,'','RTD','Isolated',10,'',true,'Pt/Ni/Cu; 1-4000Ω; CJC'),
  _s('1769-IT6','6-Channel Thermocouple/mV Input','1769','Analog','Input',6,'','Thermocouple','Non-isolated',10,'',true,'B/E/J/K/N/R/S/T; built-in CJC'),
  _s('1769-IF4K','4-Channel ±10V / 0-20mA Analog Input (Conformal Coated)','1769','Analog','Input',4,'','±10V / 0-20mA','Non-isolated',8,'',true,'Conformal coated'),
  _s('1769-IF8K','8-Channel ±10V / 0-20mA Analog Input (Conformal Coated)','1769','Analog','Input',8,'','±10V / 0-20mA','Non-isolated',12,'',true,'Conformal coated'),

  // -- Analog Output --
  _s('1769-OF2','2-Channel ±10V / 0-20mA Analog Output','1769','Analog','Output',2,'','±10V / 0-20mA','Non-isolated',6,'',true,''),
  _s('1769-OF4','4-Channel ±10V / 0-20mA Analog Output','1769','Analog','Output',4,'','±10V / 0-20mA','Non-isolated',8,'',true,''),
  _s('1769-OF4CI','4-Channel 0/4-20mA Current Output, Isolated','1769','Analog','Output',4,'','4-20mA','Isolated',8,'',true,'Current isolated'),
  _s('1769-OF4VI','4-Channel ±10V Voltage Output, Isolated','1769','Analog','Output',4,'','0-10V','Isolated',8,'',true,'Voltage isolated'),
  _s('1769-OF8C','8-Channel 0/4-20mA Current Output','1769','Analog','Output',8,'','4-20mA','Non-isolated',12,'',true,'Current only'),
  _s('1769-OF8V','8-Channel ±10V / 0-10V Voltage Output','1769','Analog','Output',8,'','0-10V','Non-isolated',12,'',true,'Voltage only'),
  _s('1769-OF2K','2-Channel ±10V / 0-20mA Analog Output (Conformal Coated)','1769','Analog','Output',2,'','±10V / 0-20mA','Non-isolated',6,'',true,'Conformal coated'),
  _s('1769-OF4K','4-Channel ±10V / 0-20mA Analog Output (Conformal Coated)','1769','Analog','Output',4,'','±10V / 0-20mA','Non-isolated',8,'',true,'Conformal coated'),

  // -- Combination --
  _s('1769-IQ6XOW4','6-Point 24VDC Input / 4-Point Relay Output Combo','1769','Digital','Combo',10,'','','Non-isolated',14,'',true,''),
  _s('1769-IF4XOF2','4-Channel Analog Input / 2-Channel Analog Output Combo','1769','Analog','Combo',6,'','±10V / 0-20mA','Non-isolated',10,'',true,''),
  _s('1769-IF4FXOF2F','4-Channel Analog Input / 2-Channel Analog Output Combo, High-Speed','1769','Analog','Combo',6,'','±10V / 0-20mA','Non-isolated',10,'',true,'High-speed variant'),
  _s('1769-IF4XOF2K','4-Channel Analog Input / 2-Channel Analog Output Combo (Conformal Coated)','1769','Analog','Combo',6,'','±10V / 0-20mA','Non-isolated',10,'',true,'Conformal coated'),

  // -- Communication --
  _s('1769-AENTR','EtherNet/IP Adapter, 2-Port DLR','1769','Communication','N/A',0,'','','N/A',0,'',true,'Device-Level Ring capable'),
  _s('1769-ADN','DeviceNet Adapter','1769','Communication','N/A',0,'','','N/A',0,'',true,''),
  _s('1769-SDN','DeviceNet Scanner','1769','Communication','N/A',0,'','','N/A',0,'',true,''),
  _s('1769-SM2','DSI/Modbus RTU Serial Module','1769','Communication','N/A',0,'','','N/A',0,'',true,'For PowerFlex drives; RS-485/232'),

  // -- Specialty --
  _s('1769-HSC','High-Speed Counter Module','1769','Specialty','N/A',0,'','','N/A',0,'',true,'2 counters; 1MHz; ABZ quadrature; 4 DO'),
  _s('1769-ASCII','ASCII/Serial Interface Module (2-Port)','1769','Specialty','N/A',0,'','','N/A',0,'',true,'RS-232/RS-485/RS-422'),
  _s('1769-BOOLEAN','Boolean Logic Module','1769','Specialty','N/A',0,'','','N/A',0,'',true,'Standalone relay logic without controller'),
  _s('1769-ARM','Address Reserve Module','1769','Specialty','N/A',0,'','','N/A',0,'',false,'Slot placeholder; does not occupy a numbered slot'),

  // ======================================================
  // 1768 CompactLogix Bridge Platform
  // ======================================================

  // -- Controllers --
  _s('1768-L43','CompactLogix L43 Controller, 2MB','1768','Controller','N/A',0,'','','N/A',0,'',true,'Up to 2×1768 modules'),
  _s('1768-L43S','Compact GuardLogix L43S Safety Controller, 2MB','1768','Controller','N/A',0,'','','N/A',0,'',true,'Safety (SIL2/PLe); up to 2×1768 modules'),
  _s('1768-L45','CompactLogix L45 Controller, 3MB','1768','Controller','N/A',0,'','','N/A',0,'',true,'Up to 4×1768 modules'),
  _s('1768-L45S','Compact GuardLogix L45S Safety Controller, 3MB','1768','Controller','N/A',0,'','','N/A',0,'',true,'Safety (SIL2/PLe); up to 4×1768 modules'),

  // -- Communication (1768 local bus) --
  _s('1768-CNB','ControlNet Bridge, Single Media','1768','Communication','N/A',0,'','','N/A',0,'',true,'Mounts on 1768 local bus'),
  _s('1768-CNBR','ControlNet Bridge, Redundant Media','1768','Communication','N/A',0,'','','N/A',0,'',true,'Redundant coax; mounts on 1768 local bus'),
  _s('1768-ENBT','EtherNet/IP Bridge, 10/100 Mbps','1768','Communication','N/A',0,'','','N/A',0,'',true,'128 CIP connections; mounts on 1768 local bus'),
  _s('1768-EWEB','EtherNet/IP Enhanced Web Server Bridge','1768','Communication','N/A',0,'','','N/A',0,'',true,'Built-in web server; mounts on 1768 local bus'),

  // -- Motion --
  _s('1768-M04SE','4-Axis SERCOS Interface Motion Module','1768','Motion','N/A',4,'','','N/A',0,'',true,'4/8 Mbps fiber ring; Kinetix 2000/6000/7000 compatible'),

  // ======================================================
  // 5069 Compact 5000 (CompactLogix 5380)
  // ======================================================

  // -- Controllers: Standard ER --
  _s('5069-L306ER','CompactLogix 5380 ER Controller, 0.6MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L310ER','CompactLogix 5380 ER Controller, 1MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L310ER-NSE','CompactLogix 5380 ER Controller, 1MB (No Safety Entry)','5069','Controller','N/A',0,'','','N/A',0,'',true,'NSE — no safety task'),
  _s('5069-L320ER','CompactLogix 5380 ER Controller, 2MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L330ER','CompactLogix 5380 ER Controller, 3MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L340ER','CompactLogix 5380 ER Controller, 4MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L350ER','CompactLogix 5380 ER Controller, 5MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L380ER','CompactLogix 5380 ER Controller, 8MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),

  // -- Controllers: Motion ERM --
  _s('5069-L306ERM','CompactLogix 5380 ERM Motion Controller, 0.6MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L310ERM','CompactLogix 5380 ERM Motion Controller, 1MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L320ERM','CompactLogix 5380 ERM Motion Controller, 2MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L330ERM','CompactLogix 5380 ERM Motion Controller, 3MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L340ERM','CompactLogix 5380 ERM Motion Controller, 4MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L350ERM','CompactLogix 5380 ERM Motion Controller, 5MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L380ERM','CompactLogix 5380 ERM Motion Controller, 8MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L3100ERM','CompactLogix 5380 ERM Motion Controller, 100MB','5069','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('5069-L320ERMK','CompactLogix 5380 ERM Motion Controller, 2MB (Conformal Coated)','5069','Controller','N/A',0,'','','N/A',0,'',true,'Conformal coated'),
  _s('5069-L330ERMK','CompactLogix 5380 ERM Motion Controller, 3MB (Conformal Coated)','5069','Controller','N/A',0,'','','N/A',0,'',true,'Conformal coated'),
  _s('5069-L350ERMK','CompactLogix 5380 ERM Motion Controller, 5MB (Conformal Coated)','5069','Controller','N/A',0,'','','N/A',0,'',true,'Conformal coated'),

  // -- Controllers: Process ERP --
  _s('5069-L320ERP','CompactLogix 5380 ERP Process Controller, 2MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Process control; CIP motion'),
  _s('5069-L340ERP','CompactLogix 5380 ERP Process Controller, 4MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Process control; CIP motion'),

  // -- Controllers: Safety ERS2 --
  _s('5069-L306ERS2','Compact GuardLogix 5380 ERS2 Safety Controller, 0.6MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('5069-L310ERS2','Compact GuardLogix 5380 ERS2 Safety Controller, 1MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('5069-L320ERS2','Compact GuardLogix 5380 ERS2 Safety Controller, 2MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('5069-L330ERS2','Compact GuardLogix 5380 ERS2 Safety Controller, 3MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('5069-L340ERS2','Compact GuardLogix 5380 ERS2 Safety Controller, 4MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('5069-L350ERS2','Compact GuardLogix 5380 ERS2 Safety Controller, 5MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('5069-L380ERS2','Compact GuardLogix 5380 ERS2 Safety Controller, 8MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('5069-L320ERS2K','Compact GuardLogix 5380 ERS2 Safety Controller, 2MB (Conformal)','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe; conformal coated'),
  _s('5069-L330ERS2K','Compact GuardLogix 5380 ERS2 Safety Controller, 3MB (Conformal)','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe; conformal coated'),
  _s('5069-L350ERS2K','Compact GuardLogix 5380 ERS2 Safety Controller, 5MB (Conformal)','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe; conformal coated'),

  // -- Controllers: Safety+Motion ERMS2 --
  _s('5069-L306ERMS2','Compact GuardLogix 5380 ERMS2 Safety+Motion Controller, 0.6MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe + motion'),
  _s('5069-L310ERMS2','Compact GuardLogix 5380 ERMS2 Safety+Motion Controller, 1MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe + motion'),
  _s('5069-L320ERMS2','Compact GuardLogix 5380 ERMS2 Safety+Motion Controller, 2MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe + motion'),
  _s('5069-L330ERMS2','Compact GuardLogix 5380 ERMS2 Safety+Motion Controller, 3MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe + motion'),
  _s('5069-L340ERMS2','Compact GuardLogix 5380 ERMS2 Safety+Motion Controller, 4MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe + motion'),
  _s('5069-L350ERMS2','Compact GuardLogix 5380 ERMS2 Safety+Motion Controller, 5MB','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe + motion'),
  _s('5069-L320ERMS2K','Compact GuardLogix 5380 ERMS2 Safety+Motion Controller, 2MB (Conformal)','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety + motion; conformal coated'),
  _s('5069-L330ERMS2K','Compact GuardLogix 5380 ERMS2 Safety+Motion Controller, 3MB (Conformal)','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety + motion; conformal coated'),
  _s('5069-L350ERMS2K','Compact GuardLogix 5380 ERMS2 Safety+Motion Controller, 5MB (Conformal)','5069','Controller','N/A',0,'','','N/A',0,'',true,'Safety + motion; conformal coated'),

  // -- Digital Input --
  _s('5069-IA8','8-Point 120/240V AC Input','5069','Digital','Input',8,'120/240VAC','','Non-isolated',12,'',true,''),
  _s('5069-IA16','16-Point 120V AC Input','5069','Digital','Input',16,'120VAC','','Non-isolated',20,'',true,''),
  _s('5069-IB8','8-Point 24V DC Source/Sink Input','5069','Digital','Input',8,'24VDC','','Non-isolated',12,'',true,''),
  _s('5069-IB16','16-Point 24V DC Source/Sink Input','5069','Digital','Input',16,'24VDC','','Non-isolated',20,'',true,''),
  _s('5069-IB16F','16-Point 24V DC Fast Input','5069','Digital','Input',16,'24VDC','','Non-isolated',20,'',true,'High-speed'),
  _s('5069-IB6F-3W','6-Point 24V DC Fast Input, 3-Wire','5069','Digital','Input',6,'24VDC','','Non-isolated',10,'',true,'High-speed; 3-wire sensor wiring'),
  _s('5069-IB8S','8-Point 24V DC Safety Input','5069','Digital','Input',8,'24VDC','','Non-isolated',12,'',true,'GuardLogix safety rated; SIL2/PLe'),
  _s('5069-IB16K','16-Point 24V DC Source/Sink Input (Conformal Coated)','5069','Digital','Input',16,'24VDC','','Non-isolated',20,'',true,'Conformal coated'),

  // -- Digital Output --
  _s('5069-OA16','16-Point 120/240V AC Output','5069','Digital','Output',16,'120/240VAC','','Non-isolated',20,'',true,''),
  _s('5069-OB8','8-Point 24V DC Sourcing Output, 2A/pt','5069','Digital','Output',8,'24VDC','','Non-isolated',12,'',true,'2A per point'),
  _s('5069-OB16','16-Point 24V DC Sourcing Output, 0.5A/pt','5069','Digital','Output',16,'24VDC','','Non-isolated',20,'',true,'0.5A per point'),
  _s('5069-OB16F','16-Point 24V DC Fast Output','5069','Digital','Output',16,'24VDC','','Non-isolated',20,'',true,'High-speed'),
  _s('5069-OBV8','8-Point 24V DC Sourcing Output with Diagnostics','5069','Digital','Output',8,'24VDC','','Non-isolated',12,'',true,'Per-point diagnostics'),
  _s('5069-OW4I','4-Point Relay Output, Isolated, 5-265V AC/DC','5069','Digital','Output',4,'5-265V AC/DC','','Individually-isolated',12,'',true,'Form A relay; individually isolated'),
  _s('5069-OW16','16-Point Relay Output, 5-265V AC/DC','5069','Digital','Output',16,'5-265V AC/DC','','Non-isolated',20,'',true,'Form A relay'),
  _s('5069-OX4I','4-Point Relay NO+NC Output, Isolated, 5-265V AC/DC','5069','Digital','Output',4,'5-265V AC/DC','','Individually-isolated',14,'',true,'Form C relay; individually isolated'),
  _s('5069-OBV8S','8-Point 24V DC Sourcing Safety Output with Diagnostics','5069','Digital','Output',8,'24VDC','','Non-isolated',12,'',true,'GuardLogix safety rated; SIL2/PLe'),
  _s('5069-OB16K','16-Point 24V DC Sourcing Output (Conformal Coated)','5069','Digital','Output',16,'24VDC','','Non-isolated',20,'',true,'Conformal coated'),

  // -- Analog Input --
  _s('5069-IF8','8-Channel ±10V / 0-20mA Analog Input','5069','Analog','Input',8,'','±10V / 0-20mA','Non-isolated',12,'',true,''),
  _s('5069-IF16','16-Channel ±10V / 0-20mA Analog Input','5069','Analog','Input',16,'','±10V / 0-20mA','Non-isolated',20,'',true,''),
  _s('5069-IF4IH','4-Channel 4-20mA HART Analog Input, Isolated','5069','Analog','Input',4,'','4-20mA','Isolated',8,'',true,'HART protocol; isolated channels'),
  _s('5069-IY4','4-Channel ±10V / 0-20mA Analog Input, High Density','5069','Analog','Input',4,'','±10V / 0-20mA','Non-isolated',8,'',true,'High density; 0.5 slot width'),
  _s('5069-IT8','8-Channel Thermocouple Input','5069','Analog','Input',8,'','Thermocouple','Non-isolated',12,'',true,'J/K/T/E/R/S/B/N types'),
  _s('5069-IR8','8-Channel RTD/Resistance Input','5069','Analog','Input',8,'','RTD','Non-isolated',12,'',true,'Pt100, Pt1000, Ni, Cu'),
  _s('5069-IY4K','4-Channel ±10V / 0-20mA Analog Input (Conformal Coated)','5069','Analog','Input',4,'','±10V / 0-20mA','Non-isolated',8,'',true,'Conformal coated'),

  // -- Analog Output --
  _s('5069-OF4','4-Channel ±10V / 0-20mA Analog Output','5069','Analog','Output',4,'','±10V / 0-20mA','Non-isolated',8,'',true,''),
  _s('5069-OF4IH','4-Channel 4-20mA HART Analog Output, Isolated','5069','Analog','Output',4,'','4-20mA','Isolated',8,'',true,'HART protocol; isolated channels'),
  _s('5069-OF8','8-Channel ±10V / 0-20mA Analog Output','5069','Analog','Output',8,'','±10V / 0-20mA','Non-isolated',12,'',true,''),
  _s('5069-OF4K','4-Channel ±10V / 0-20mA Analog Output (Conformal Coated)','5069','Analog','Output',4,'','±10V / 0-20mA','Non-isolated',8,'',true,'Conformal coated'),

  // -- Communication / Specialty --
  _s('5069-AENTR','EtherNet/IP Adapter, 2-Port DLR','5069','Communication','N/A',0,'','','N/A',0,'',true,'Device-Level Ring capable'),
  _s('5069-AEN2TR','EtherNet/IP Adapter, Dual-Port, 2 Independent IPs','5069','Communication','N/A',0,'','','N/A',0,'',true,'Two independent IP addresses'),
  _s('5069-HSC2XOB4','High-Speed Counter (2ch, 1MHz) + 4-Point DO','5069','Specialty','Combo',2,'','','N/A',0,'',true,'2 counter channels + 4 digital outputs'),
  _s('5069-SERIAL','Serial Interface Module, 2-Port','5069','Communication','N/A',0,'','','N/A',0,'',true,'ASCII/Modbus RTU/DF1; RS-232/RS-485'),
  _s('5069-AENTRK','EtherNet/IP Adapter, 2-Port DLR (Conformal Coated)','5069','Communication','N/A',0,'','','N/A',0,'',true,'Conformal coated'),

  // -- Accessories (non-slot) --
  _s('5069-FPD','Field Potential Distributor','5069','Specialty','N/A',0,'','','N/A',0,'',false,'SA power bus expansion; does not occupy a slot'),
  _s('5069-ARM','Address Reserve Module','5069','Specialty','N/A',0,'','','N/A',0,'',false,'Slot placeholder; does not occupy a numbered slot'),
  _s('5069-ECR','End Cap Right Bank Terminator','5069','Specialty','N/A',0,'','','N/A',0,'',false,'Right-end terminator for 5069 bank; no slot number'),

  // ======================================================
  // 1756 ControlLogix
  // ======================================================

  // -- Controllers: 5580 Current --
  _s('1756-L81E','ControlLogix 5580 Controller, 3MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Studio 5000 v30+'),
  _s('1756-L82E','ControlLogix 5580 Controller, 5MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Studio 5000 v30+'),
  _s('1756-L83E','ControlLogix 5580 Controller, 10MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Studio 5000 v30+'),
  _s('1756-L84E','ControlLogix 5580 Controller, 20MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Studio 5000 v30+'),
  _s('1756-L85E','ControlLogix 5580 Controller, 40MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Studio 5000 v30+'),
  _s('1756-L81ES','GuardLogix 5580 Safety Controller, 3MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe; Studio 5000 v30+'),
  _s('1756-L82ES','GuardLogix 5580 Safety Controller, 5MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe; Studio 5000 v30+'),
  _s('1756-L83ES','GuardLogix 5580 Safety Controller, 10MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe; Studio 5000 v30+'),
  _s('1756-L84ES','GuardLogix 5580 Safety Controller, 20MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe; Studio 5000 v30+'),
  _s('1756-L85ES','GuardLogix 5580 Safety Controller, 40MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe; Studio 5000 v30+'),

  // -- Controllers: 5570 Previous Generation --
  _s('1756-L71','ControlLogix 5570 Controller, 2MB','1756','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1756-L72','ControlLogix 5570 Controller, 4MB','1756','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1756-L73','ControlLogix 5570 Controller, 8MB','1756','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1756-L74','ControlLogix 5570 Controller, 16MB','1756','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1756-L75','ControlLogix 5570 Controller, 32MB','1756','Controller','N/A',0,'','','N/A',0,'',true,''),
  _s('1756-L71S','GuardLogix 5570 Safety Controller, 2MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('1756-L72S','GuardLogix 5570 Safety Controller, 4MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('1756-L73S','GuardLogix 5570 Safety Controller, 8MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Safety SIL2/PLe'),
  _s('1756-L73XT','ControlLogix 5570 XT Controller, 8MB (Extended Temp)','1756','Controller','N/A',0,'','','N/A',0,'',true,'Extended temp: -25 to 65°C'),

  // -- Controllers: 5560 Legacy --
  _s('1756-L61','ControlLogix 5560 Legacy Controller, 2MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1756-L62','ControlLogix 5560 Legacy Controller, 4MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1756-L63','ControlLogix 5560 Legacy Controller, 8MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1756-L63XT','ControlLogix 5560 XT Legacy Controller, 8MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; extended temp; discontinued'),
  _s('1756-L64','ControlLogix 5560 Legacy Controller, 16MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1756-L65','ControlLogix 5560 Legacy Controller, 32MB','1756','Controller','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),

  // -- Digital Input: AC --
  _s('1756-IA8D','8-Point 120V AC Input, Diagnostic','1756','Digital','Input',8,'120VAC','','Non-isolated',20,'1756-TBCH',true,'Blown fuse detection per group'),
  _s('1756-IA16','16-Point 120V AC Input','1756','Digital','Input',16,'120VAC','','Non-isolated',36,'1756-TBCH',true,''),
  _s('1756-IA16I','16-Point 120V AC Input, Individually Isolated','1756','Digital','Input',16,'120VAC','','Individually-isolated',36,'1756-TBCH',true,''),
  _s('1756-IA32','32-Point 120V AC Input, High Density','1756','Digital','Input',32,'120VAC','','Non-isolated',40,'1756-TBNH',true,'High density'),
  _s('1756-IM16I','16-Point 240V AC Input, Individually Isolated','1756','Digital','Input',16,'240VAC','','Individually-isolated',36,'1756-TBCH',true,''),
  _s('1756-IN16','16-Point 24V AC Input','1756','Digital','Input',16,'24VAC','','Non-isolated',36,'1756-TBCH',true,''),

  // -- Digital Input: DC --
  _s('1756-IB16','16-Point 12/24V DC Sinking Input','1756','Digital','Input',16,'12/24VDC','','Non-isolated',36,'1756-TBNH',true,''),
  _s('1756-IB16D','16-Point 12/24V DC Sinking Input, Diagnostic','1756','Digital','Input',16,'12/24VDC','','Non-isolated',36,'1756-TBCH',true,'Open-wire detection'),
  _s('1756-IB16I','16-Point 12/24V DC Sinking Input, Isolated','1756','Digital','Input',16,'12/24VDC','','Isolated',36,'1756-TBCH',true,'Group isolated'),
  _s('1756-IB16IF','16-Point 12/24V DC Sinking Input, Isolated Fast','1756','Digital','Input',16,'12/24VDC','','Isolated',36,'1756-TBCH',true,'High-speed; group isolated'),
  _s('1756-IB16ISOE','16-Point 24/48V DC Sinking Input, Isolated SOE','1756','Digital','Input',16,'24/48VDC','','Isolated',36,'1756-TBCH',true,'Sequence of Events; 1ms timestamp'),
  _s('1756-IB32','32-Point 12/24V DC Sinking Input, High Density','1756','Digital','Input',32,'12/24VDC','','Non-isolated',40,'1756-TBNH',true,''),
  _s('1756-IC16','16-Point 48V DC Sinking Input','1756','Digital','Input',16,'48VDC','','Non-isolated',36,'1756-TBCH',true,''),
  _s('1756-IG16','16-Point 5V DC TTL Input','1756','Digital','Input',16,'5VDC','','Non-isolated',36,'1756-TBCH',true,'TTL logic'),
  _s('1756-IH16I','16-Point 125V DC Input, Individually Isolated','1756','Digital','Input',16,'125VDC','','Individually-isolated',36,'1756-TBCH',true,''),
  _s('1756-IH16ISOE','16-Point 125V DC Input, Isolated SOE','1756','Digital','Input',16,'125VDC','','Isolated',36,'1756-TBCH',true,'Sequence of Events'),
  _s('1756-IV16','16-Point 12/24V DC Sourcing Input','1756','Digital','Input',16,'12/24VDC','','Non-isolated',36,'1756-TBNH',true,''),
  _s('1756-IV32','32-Point 12/24V DC Sourcing Input, High Density','1756','Digital','Input',32,'12/24VDC','','Non-isolated',40,'1756-TBNH',true,''),

  // -- Digital Output: AC --
  _s('1756-OA8','8-Point 120/240V AC Output','1756','Digital','Output',8,'120/240VAC','','Non-isolated',20,'1756-TBCH',true,''),
  _s('1756-OA8D','8-Point 120/240V AC Output, Diagnostic','1756','Digital','Output',8,'120/240VAC','','Non-isolated',20,'1756-TBCH',true,'Load detection'),
  _s('1756-OA8E','8-Point 120/240V AC Output, Electronic Fused','1756','Digital','Output',8,'120/240VAC','','Non-isolated',20,'1756-TBCH',true,'Electronic fuse per group'),
  _s('1756-OA16','16-Point 120/240V AC Output','1756','Digital','Output',16,'120/240VAC','','Non-isolated',36,'1756-TBNH',true,''),
  _s('1756-OA16I','16-Point 120/240V AC Output, Individually Isolated','1756','Digital','Output',16,'120/240VAC','','Individually-isolated',36,'1756-TBCH',true,''),
  _s('1756-ON8','8-Point 120/240V AC Normally ON Output','1756','Digital','Output',8,'120/240VAC','','Non-isolated',20,'1756-TBCH',true,'Normally ON fail-safe state'),

  // -- Digital Output: DC --
  _s('1756-OB8','8-Point 12/24V DC Sourcing Output','1756','Digital','Output',8,'12/24VDC','','Non-isolated',20,'1756-TBCH',true,'2A/pt'),
  _s('1756-OB8EI','8-Point 24V DC Sourcing Output, E-Fused Isolated','1756','Digital','Output',8,'24VDC','','Isolated',20,'1756-TBCH',true,'Electronic fuse; isolated'),
  _s('1756-OB8I','8-Point 24V DC Sourcing Output, Isolated','1756','Digital','Output',8,'24VDC','','Isolated',20,'1756-TBCH',true,'Group isolated'),
  _s('1756-OB16D','16-Point 12/24V DC Sourcing Output, Diagnostic','1756','Digital','Output',16,'12/24VDC','','Non-isolated',36,'1756-TBCH',true,'Load detection; short-circuit diagnostic'),
  _s('1756-OB16E','16-Point 12/24V DC Sourcing Output, E-Fused','1756','Digital','Output',16,'12/24VDC','','Non-isolated',36,'1756-TBNH',true,'Electronic fuse per group'),
  _s('1756-OB16I','16-Point 12/24V DC Sourcing Output, Isolated','1756','Digital','Output',16,'12/24VDC','','Isolated',36,'1756-TBCH',true,'Group isolated'),
  _s('1756-OB16IEF','16-Point 10-30V DC Output, Isolated/E-Fused/Fast','1756','Digital','Output',16,'10-30VDC','','Isolated',36,'1756-TBCH',true,'Electronic fuse; isolated; high-speed'),
  _s('1756-OB16IEFS','16-Point 10-30V DC Output, Isolated/E-Fused/Fast/Safe State','1756','Digital','Output',16,'10-30VDC','','Isolated',36,'1756-TBCH',true,'Electronic fuse; isolated; HS; safe-state'),
  _s('1756-OB16IS','16-Point 12/24V DC Sourcing Output, Isolated+Protected','1756','Digital','Output',16,'12/24VDC','','Isolated',36,'1756-TBCH',true,'Over-temp protection'),
  _s('1756-OB32','32-Point 12/24V DC Sourcing Output, High Density','1756','Digital','Output',32,'12/24VDC','','Non-isolated',40,'1756-TBNH',true,''),
  _s('1756-OC8','8-Point 48V DC Sourcing Output','1756','Digital','Output',8,'48VDC','','Non-isolated',20,'1756-TBCH',true,''),
  _s('1756-OG16','16-Point 5V DC TTL Output','1756','Digital','Output',16,'5VDC','','Non-isolated',36,'1756-TBCH',true,'TTL logic'),
  _s('1756-OH8I','8-Point 125V DC Output, Individually Isolated','1756','Digital','Output',8,'125VDC','','Individually-isolated',20,'1756-TBCH',true,''),
  _s('1756-OV16E','16-Point 12/24V DC Sinking Output, E-Fused','1756','Digital','Output',16,'12/24VDC','','Non-isolated',36,'1756-TBNH',true,'Sinking; electronic fuse'),
  _s('1756-OV32E','32-Point 12/24V DC Sinking Output, E-Fused, High Density','1756','Digital','Output',32,'12/24VDC','','Non-isolated',40,'1756-TBNH',true,'Sinking; electronic fuse'),

  // -- Digital Output: Relay --
  _s('1756-OW16','16-Point Relay NO Output, Non-Isolated, 5-265V AC/DC','1756','Digital','Output',16,'5-265V AC/DC','','Non-isolated',36,'1756-TBNH',true,'Legacy/discontinued; non-isolated relay'),
  _s('1756-OW16I','16-Point Relay NO Output, Individually Isolated, 5-265V AC/DC','1756','Digital','Output',16,'5-265V AC/DC','','Individually-isolated',36,'1756-TBCH',true,'Form A relay; individually isolated'),
  _s('1756-OX8I','8-Point Relay NO+NC Output, Individually Isolated, 5-265V AC/DC','1756','Digital','Output',8,'5-265V AC/DC','','Individually-isolated',28,'1756-TBCH',true,'Form C relay; individually isolated'),

  // -- Analog Input --
  _s('1756-IF6I','6-Channel ±10V / 0-20mA Analog Input, Isolated','1756','Analog','Input',6,'','±10V / 0-20mA','Isolated',20,'1756-TBCH',true,''),
  _s('1756-IF6CIS','6-Channel 0-20mA Current Sourcing Input, Isolated','1756','Analog','Input',6,'','4-20mA','Isolated',20,'1756-TBCH',true,'Current sourcing; isolated'),
  _s('1756-IF8','8-Channel ±10V / 0-20mA Analog Input','1756','Analog','Input',8,'','±10V / 0-20mA','Non-isolated',20,'1756-TBNH',true,''),
  _s('1756-IF8I','8-Channel ±10V / 0-20mA Analog Input, Isolated','1756','Analog','Input',8,'','±10V / 0-20mA','Isolated',20,'1756-TBCH',true,''),
  _s('1756-IF8H','8-Channel 4-20mA HART Analog Input','1756','Analog','Input',8,'','4-20mA','Non-isolated',20,'1756-TBNH',true,'HART protocol'),
  _s('1756-IF8IH','8-Channel 4-20mA HART Analog Input, Isolated','1756','Analog','Input',8,'','4-20mA','Isolated',20,'1756-TBCH',true,'HART protocol; isolated'),
  _s('1756-IF16','16-Channel ±10V / 0-20mA Analog Input','1756','Analog','Input',16,'','±10V / 0-20mA','Non-isolated',36,'1756-TBNH',true,''),
  _s('1756-IF16H','16-Channel 4-20mA HART Analog Input','1756','Analog','Input',16,'','4-20mA','Non-isolated',36,'1756-TBNH',true,'HART protocol'),
  _s('1756-IF16IH','16-Channel 4-20mA HART Analog Input, Isolated','1756','Analog','Input',16,'','4-20mA','Isolated',36,'1756-TBCH',true,'HART protocol; isolated'),
  _s('1756-IF8IK','8-Channel ±10V / 0-20mA Analog Input, Isolated (Conformal)','1756','Analog','Input',8,'','±10V / 0-20mA','Isolated',20,'1756-TBCH',true,'Conformal coated'),
  _s('1756-IF8HK','8-Channel 4-20mA HART Analog Input (Conformal)','1756','Analog','Input',8,'','4-20mA','Non-isolated',20,'1756-TBNH',true,'Conformal coated'),
  _s('1756-IF8IHK','8-Channel 4-20mA HART Analog Input, Isolated (Conformal)','1756','Analog','Input',8,'','4-20mA','Isolated',20,'1756-TBCH',true,'Conformal coated'),
  _s('1756-IF16K','16-Channel ±10V / 0-20mA Analog Input (Conformal)','1756','Analog','Input',16,'','±10V / 0-20mA','Non-isolated',36,'1756-TBNH',true,'Conformal coated'),
  _s('1756-IF16HK','16-Channel 4-20mA HART Analog Input (Conformal)','1756','Analog','Input',16,'','4-20mA','Non-isolated',36,'1756-TBNH',true,'Conformal coated'),
  _s('1756-IF16IHK','16-Channel 4-20mA HART Analog Input, Isolated (Conformal)','1756','Analog','Input',16,'','4-20mA','Isolated',36,'1756-TBCH',true,'Conformal coated'),

  // -- RTD / Thermocouple Input --
  _s('1756-IR6I','6-Channel RTD/Resistance Input, Isolated','1756','Analog','Input',6,'','RTD','Isolated',20,'1756-TBCH',true,'Pt/Ni/Cu; 1-4000Ω'),
  _s('1756-IRT8I','8-Channel RTD+Thermocouple Combo Input, Isolated','1756','Analog','Input',8,'','RTD','Isolated',20,'1756-TBCH',true,'Combined RTD and TC input; isolated'),
  _s('1756-IT6I','6-Channel Thermocouple/mV Input, Isolated','1756','Analog','Input',6,'','Thermocouple','Isolated',20,'1756-TBCH',true,'B/E/J/K/N/R/S/T types'),
  _s('1756-IT16','16-Channel Thermocouple Input','1756','Analog','Input',16,'','Thermocouple','Non-isolated',36,'1756-TBNH',true,''),
  _s('1756-IRT8IK','8-Channel RTD+Thermocouple Combo Input, Isolated (Conformal)','1756','Analog','Input',8,'','RTD','Isolated',20,'1756-TBCH',true,'Conformal coated'),

  // -- Analog Output --
  _s('1756-OF4','4-Channel ±10V / 0-20mA Analog Output','1756','Analog','Output',4,'','±10V / 0-20mA','Non-isolated',20,'1756-TBNH',true,''),
  _s('1756-OF6CI','6-Channel 0-20mA Current Output, Isolated','1756','Analog','Output',6,'','4-20mA','Isolated',20,'1756-TBCH',true,'Current only; isolated'),
  _s('1756-OF6VI','6-Channel ±10V Voltage Output, Isolated','1756','Analog','Output',6,'','0-10V','Isolated',20,'1756-TBCH',true,'Voltage only; isolated'),
  _s('1756-OF8','8-Channel ±10V / 0-20mA Analog Output','1756','Analog','Output',8,'','±10V / 0-20mA','Non-isolated',20,'1756-TBNH',true,''),
  _s('1756-OF8I','8-Channel ±10V / 0-20mA Analog Output, Isolated','1756','Analog','Output',8,'','±10V / 0-20mA','Isolated',20,'1756-TBCH',true,''),
  _s('1756-OF8H','8-Channel 4-20mA HART Analog Output','1756','Analog','Output',8,'','4-20mA','Non-isolated',20,'1756-TBNH',true,'HART protocol'),
  _s('1756-OF8IH','8-Channel 4-20mA HART Analog Output, Isolated','1756','Analog','Output',8,'','4-20mA','Isolated',20,'1756-TBCH',true,'HART protocol; isolated'),
  _s('1756-OF4K','4-Channel ±10V / 0-20mA Analog Output (Conformal)','1756','Analog','Output',4,'','±10V / 0-20mA','Non-isolated',20,'1756-TBNH',true,'Conformal coated'),
  _s('1756-OF8K','8-Channel ±10V / 0-20mA Analog Output (Conformal)','1756','Analog','Output',8,'','±10V / 0-20mA','Non-isolated',20,'1756-TBNH',true,'Conformal coated'),
  _s('1756-OF8IK','8-Channel ±10V / 0-20mA Analog Output, Isolated (Conformal)','1756','Analog','Output',8,'','±10V / 0-20mA','Isolated',20,'1756-TBCH',true,'Conformal coated'),
  _s('1756-OF8HK','8-Channel 4-20mA HART Analog Output (Conformal)','1756','Analog','Output',8,'','4-20mA','Non-isolated',20,'1756-TBNH',true,'Conformal coated'),
  _s('1756-OF8IHK','8-Channel 4-20mA HART Analog Output, Isolated (Conformal)','1756','Analog','Output',8,'','4-20mA','Isolated',20,'1756-TBCH',true,'Conformal coated'),

  // -- Combination Analog --
  _s('1756-IF4FXOF2F','4-Channel Analog In / 2-Channel Analog Out, High-Speed','1756','Analog','Combo',6,'','±10V / 0-20mA','Non-isolated',20,'1756-TBCH',true,'High-speed; used for servo/process loops'),

  // -- Communication: EtherNet/IP --
  _s('1756-ENBT','EtherNet/IP Bridge, 10/100 Mbps','1756','Communication','N/A',0,'','','N/A',0,'',true,'Legacy bridge module'),
  _s('1756-EN2T','EtherNet/IP Bridge, 10/100 Mbps, 256 connections','1756','Communication','N/A',0,'','','N/A',0,'',true,''),
  _s('1756-EN2TP','EtherNet/IP Bridge, 10/100 Mbps, Parallel Redundancy Protocol','1756','Communication','N/A',0,'','','N/A',0,'',true,'PRP for redundant networks'),
  _s('1756-EN2TR','EtherNet/IP Bridge, 10/100 Mbps, DLR','1756','Communication','N/A',0,'','','N/A',0,'',true,'Device-Level Ring (2-port)'),
  _s('1756-EN2TSC','EtherNet/IP Bridge, 10/100 Mbps, Secure Communication','1756','Communication','N/A',0,'','','N/A',0,'',true,'TLS/CIP Security'),
  _s('1756-EN2F','EtherNet/IP Bridge, Fiber, 100 Mbps','1756','Communication','N/A',0,'','','N/A',0,'',true,'Multimode fiber'),
  _s('1756-EN3TR','EtherNet/IP Bridge, 10/100/1000 Mbps, DLR','1756','Communication','N/A',0,'','','N/A',0,'',true,'Gigabit; Device-Level Ring'),
  _s('1756-EN4TR','EtherNet/IP Bridge, 10/100/1000 Mbps, DLR, CIP Security','1756','Communication','N/A',0,'','','N/A',0,'',true,'Gigabit; DLR; CIP Security'),
  _s('1756-EWEB','EtherNet/IP Enhanced Web Server Module','1756','Communication','N/A',0,'','','N/A',0,'',true,'Built-in web server'),
  _s('1756-EN2TXT','EtherNet/IP Bridge, Extended Temp','1756','Communication','N/A',0,'','','N/A',0,'',true,'Extended temperature'),
  _s('1756-EN2TRXT','EtherNet/IP Bridge, DLR, Extended Temp','1756','Communication','N/A',0,'','','N/A',0,'',true,'DLR; extended temperature'),
  _s('1756-EN2TK','EtherNet/IP Bridge (Conformal Coated)','1756','Communication','N/A',0,'','','N/A',0,'',true,'Conformal coated'),
  _s('1756-EN2TRK','EtherNet/IP Bridge, DLR (Conformal Coated)','1756','Communication','N/A',0,'','','N/A',0,'',true,'Conformal coated'),
  _s('1756-EN2TPK','EtherNet/IP Bridge, PRP (Conformal Coated)','1756','Communication','N/A',0,'','','N/A',0,'',true,'Conformal coated'),
  _s('1756-EN2FK','EtherNet/IP Bridge, Fiber (Conformal Coated)','1756','Communication','N/A',0,'','','N/A',0,'',true,'Conformal coated'),
  _s('1756-EN4TRK','EtherNet/IP Bridge, Gigabit DLR (Conformal Coated)','1756','Communication','N/A',0,'','','N/A',0,'',true,'Conformal coated'),
  _s('1756-ENBTK','EtherNet/IP Bridge, 10/100 Mbps (Conformal Coated)','1756','Communication','N/A',0,'','','N/A',0,'',true,'Legacy; conformal coated'),

  // -- Communication: ControlNet --
  _s('1756-CN2','ControlNet Bridge, Single Media','1756','Communication','N/A',0,'','','N/A',0,'',true,''),
  _s('1756-CN2R','ControlNet Bridge, Redundant Media','1756','Communication','N/A',0,'','','N/A',0,'',true,'Redundant coax'),
  _s('1756-CNB','ControlNet Bridge (Legacy)','1756','Communication','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1756-CNBR','ControlNet Bridge, Redundant (Legacy)','1756','Communication','N/A',0,'','','N/A',0,'',true,'Legacy; discontinued'),
  _s('1756-CN2RXT','ControlNet Bridge, Redundant, Extended Temp','1756','Communication','N/A',0,'','','N/A',0,'',true,'Extended temperature'),
  _s('1756-CN2RK','ControlNet Bridge, Redundant (Conformal Coated)','1756','Communication','N/A',0,'','','N/A',0,'',true,'Conformal coated'),

  // -- Communication: DeviceNet --
  _s('1756-DNB','DeviceNet Scanner','1756','Communication','N/A',0,'','','N/A',0,'',true,''),

  // -- Communication: Legacy --
  _s('1756-DHRIO','DH+/Remote I/O Dual-Channel Module','1756','Communication','N/A',0,'','','N/A',0,'',true,'DH+ and Remote I/O; legacy'),
  _s('1756-DH485','DH-485 Serial Bridge','1756','Communication','N/A',0,'','','N/A',0,'',true,'Legacy serial network'),
  _s('1756-RIO','Remote I/O Scanner','1756','Communication','N/A',0,'','','N/A',0,'',true,'Legacy remote I/O scanner'),
  _s('1756-DHRIOXT','DH+/Remote I/O Dual-Channel Module, Extended Temp','1756','Communication','N/A',0,'','','N/A',0,'',true,'Extended temperature'),
  _s('1756-SYNCH','IEEE 1588 Time Synchronization Module','1756','Communication','N/A',0,'','','N/A',0,'',true,'GPS/IRIG-B time sync'),

  // -- Motion --
  _s('1756-M02AE','2-Axis Analog Servo Module, Encoder Feedback','1756','Motion','N/A',2,'','','N/A',0,'',true,'±10V command; encoder feedback'),
  _s('1756-M02AS','2-Axis Analog Servo Module, SSI Feedback','1756','Motion','N/A',2,'','','N/A',0,'',true,'±10V command; SSI absolute encoder'),
  _s('1756-HYD02','2-Axis Hydraulic Servo Module','1756','Motion','N/A',2,'','','N/A',0,'',true,'LDT feedback; for hydraulic actuators'),
  _s('1756-M08SE','8-Axis SERCOS Interface Motion Module','1756','Motion','N/A',8,'','','N/A',0,'',true,'SERCOS fiber ring; Kinetix drives'),
  _s('1756-M16SE','16-Axis SERCOS Interface Motion Module','1756','Motion','N/A',16,'','','N/A',0,'',true,'SERCOS fiber ring; Kinetix drives'),

  // -- Specialty --
  _s('1756-HSC','High-Speed Counter Module','1756','Specialty','N/A',0,'','','N/A',0,'',true,'2 counters at 1MHz; ABZ quadrature; 6 DI + 4 DO'),
  _s('1756-LSC8XIB8I','Low-Speed Counter + 8-Channel DC Input Module','1756','Specialty','Combo',16,'','','Non-isolated',36,'',true,'8 counter channels (40kHz) + 8 DC inputs; isolated'),
  _s('1756-PLS','Programmable Limit Switch Module','1756','Specialty','N/A',0,'','','N/A',0,'',true,'Resolver interface; cam-profile output'),
  _s('1756-TIME','GPS/IRIG-B Time Synchronization Module','1756','Specialty','N/A',0,'','','N/A',0,'',true,'High-accuracy time sync for SOE'),
];

/* ---- CACHE ---- */

async function getPartsLibraryCache() {
  state.cache.partsLibrary = await getAll('partsLibrary');
  return state.cache.partsLibrary;
}

/* ---- SEED ---- */

async function _forceSeedPartsLibrary() {
  const existing = await getAll('partsLibrary');
  const byCat = Object.fromEntries(existing.map(p => [p.catalogNumber?.toLowerCase(), p]));
  for (const template of PARTS_LIB_SEED) {
    if (!byCat[template.catalogNumber?.toLowerCase()]) {
      await upsert('partsLibrary', { ...template });
    }
  }
}

async function seedPartsLibrary() {
  const existing = await getAll('partsLibrary');
  if (existing.length > 0) return;
  await _forceSeedPartsLibrary();
  state.cache.partsLibrary = await getAll('partsLibrary');
}

/* ---- PAGE RENDERING ---- */

async function renderPartsLibraryPage() {
  await getPartsLibraryCache();
  const parts = state.cache.partsLibrary;

  let activePlatform = 'all';
  let activeCardType = 'all';

  el.main.innerHTML = `
    <div class="search-wrap">
      <span class="search-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input id="pl-search" class="search-input" type="search" placeholder="Search catalog number or description…">
    </div>
    <div class="chips" id="pl-platform-chips">
      <button class="chip active" data-val="all">All</button>
      ${PART_PLATFORMS.map(p => `<button class="chip" data-val="${esc(p)}">${esc(p)}</button>`).join('')}
    </div>
    <div class="chips" id="pl-cardtype-chips">
      <button class="chip active" data-val="all">All</button>
      ${PART_CARD_TYPES.map(t => `<button class="chip" data-val="${esc(t)}">${esc(t)}</button>`).join('')}
    </div>
    <div id="pl-list" class="card-list"></div>
    <div class="home-data-actions" style="margin-top:8px">
      <div class="section-label">Library Actions</div>
      <div class="home-data-btns">
        <button class="btn btn-primary" id="pl-add-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Part
        </button>
        <button class="btn btn-outline" id="pl-export-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export xlsx
        </button>
        <button class="btn btn-outline" id="pl-import-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import xlsx
        </button>
        <button class="btn btn-outline" id="pl-seed-btn">Load Default Parts</button>
      </div>
    </div>
  `;

  const listEl = el.main.querySelector('#pl-list');

  const render = () => {
    const q = el.main.querySelector('#pl-search')?.value?.toLowerCase() || '';
    const shown = parts.filter(p => {
      const matchQ = !q
        || p.catalogNumber?.toLowerCase().includes(q)
        || p.description?.toLowerCase().includes(q)
        || p.manufacturer?.toLowerCase().includes(q);
      const matchP = activePlatform === 'all' || p.platform === activePlatform;
      const matchC = activeCardType === 'all' || p.cardType === activeCardType;
      return matchQ && matchP && matchC;
    });

    if (!shown.length) {
      listEl.innerHTML = parts.length === 0
        ? `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><h3>No parts yet</h3><p>Tap <strong>Add Part</strong> or <strong>Load Default Parts</strong> to get started.</p></div>`
        : `<div class="empty"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>No results</h3><p>Try a different search or filter.</p></div>`;
      return;
    }

    listEl.innerHTML = shown.map(p => _partCardHtml(p)).join('');
    listEl.querySelectorAll('.pl-edit-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openPartForm(btn.dataset.id); });
    });
    listEl.querySelectorAll('.pl-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); deletePartLibEntry(btn.dataset.id, btn.dataset.cat); });
    });
  };

  el.main.querySelector('#pl-search').addEventListener('input', render);

  el.main.querySelector('#pl-platform-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    el.main.querySelectorAll('#pl-platform-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activePlatform = chip.dataset.val;
    render();
  });

  el.main.querySelector('#pl-cardtype-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    el.main.querySelectorAll('#pl-cardtype-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCardType = chip.dataset.val;
    render();
  });

  el.main.querySelector('#pl-add-btn').addEventListener('click', () => openPartForm());
  el.main.querySelector('#pl-export-btn').addEventListener('click', exportPartsLibraryXlsx);

  el.main.querySelector('#pl-import-btn').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.xlsx';
    inp.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) importPartsLibraryXlsx(file);
    });
    inp.click();
  });

  el.main.querySelector('#pl-seed-btn').addEventListener('click', async () => {
    const ok = await confirm('Load Default Parts', 'Add all built-in Rockwell modules to the library? Existing entries will not be overwritten.');
    if (!ok) return;
    await _forceSeedPartsLibrary();
    await getPartsLibraryCache();
    showToast('Default parts loaded', 'success');
    renderPartsLibraryPage();
  });

  render();
}

function _partCardHtml(p) {
  const metaParts = [p.platform, p.cardType];
  if (p.ioType && p.ioType !== 'N/A') metaParts.push(p.ioType);
  if (!p.slotInstalled) metaParts.push('Accessory');
  else if (p.ioPointCount > 0) metaParts.push(`${p.ioPointCount} pts`);

  const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  return `
    <div class="card">
      <div class="card-row">
        <div class="card-body">
          <div class="card-name-row">
            <div class="card-name">${esc(p.catalogNumber)}${!p.slotInstalled ? ` <span class="card-class-inline">Accessory</span>` : ''}</div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              <button class="card-delete-btn pl-edit-btn" data-id="${p.id}" aria-label="Edit" title="Edit">${editIcon}</button>
              <button class="card-delete-btn pl-delete-btn" data-id="${p.id}" data-cat="${esc(p.catalogNumber)}" aria-label="Delete" title="Delete">${ICON_TRASH}</button>
            </div>
          </div>
          ${p.description ? `<div class="card-desc">${esc(p.description)}</div>` : ''}
          <div class="card-desc" style="margin-top:4px;color:var(--text-muted,#888)">${metaParts.filter(Boolean).map(m => esc(m)).join(' · ')}</div>
        </div>
      </div>
    </div>`;
}

/* ---- PART FORM ---- */

function openPartForm(id = null) {
  const existing = id ? state.cache.partsLibrary.find(p => p.id === id) : null;
  state.formType = '__parts_lib__';
  state.formId   = id || null;
  el.formTitle.textContent = id ? 'Edit Part' : 'Add Part';
  el.formBody.innerHTML = _buildPartFormHtml(existing);
  el.backdrop.classList.add('open');
  el.sheet.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => el.sheet.classList.add('open')));
}

function _buildPartFormHtml(ex) {
  const sel = (id, opts, val) => opts.map(o =>
    `<option value="${esc(o)}"${val===o?' selected':''}>${esc(o)}</option>`
  ).join('');

  return `
    <div class="section-label">Identification</div>
    <div class="fg">
      <label class="fg-label">Catalog Number <span class="req">*</span></label>
      <input id="pl-catalogNumber" class="f-input" type="text" placeholder="e.g. 1769-IQ16" value="${esc(ex?.catalogNumber||'')}">
    </div>
    <div class="fg">
      <label class="fg-label">Manufacturer <span class="req">*</span></label>
      <input id="pl-manufacturer" class="f-input" type="text" value="${esc(ex?.manufacturer||'Rockwell Automation')}">
    </div>
    <div class="fg">
      <label class="fg-label">Platform</label>
      <select id="pl-platform" class="f-select">
        <option value="">— Select —</option>
        ${sel('pl-platform', PART_PLATFORMS, ex?.platform||'')}
      </select>
    </div>
    <div class="fg">
      <label class="fg-label">Description</label>
      <input id="pl-description" class="f-input" type="text" placeholder="Module description" value="${esc(ex?.description||'')}">
    </div>

    <div class="section-label">Classification</div>
    <div class="fg">
      <label class="fg-label">Card Type <span class="req">*</span></label>
      <select id="pl-cardType" class="f-select">
        <option value="">— Select —</option>
        ${sel('pl-cardType', PART_CARD_TYPES, ex?.cardType||'')}
      </select>
    </div>
    <div class="fg">
      <label class="fg-label">IO Type</label>
      <select id="pl-ioType" class="f-select">
        ${sel('pl-ioType', PART_IO_TYPES, ex?.ioType||'N/A')}
      </select>
    </div>
    <div class="fg">
      <label class="fg-label">IO Point Count</label>
      <input id="pl-ioPointCount" class="f-input" type="number" min="0" value="${ex?.ioPointCount||0}">
    </div>
    <div class="fg">
      <label class="fg-label">Voltage Level</label>
      <input id="pl-voltageLevel" class="f-input" type="text" placeholder="e.g. 24VDC, 120VAC" value="${esc(ex?.voltageLevel||'')}">
    </div>
    <div class="fg">
      <label class="fg-label">Signal Range</label>
      <select id="pl-signalRange" class="f-select">
        <option value="">— None —</option>
        ${sel('pl-signalRange', PART_SIGNAL_RANGES, ex?.signalRange||'')}
      </select>
    </div>
    <div class="fg">
      <label class="fg-label">Isolation Type</label>
      <select id="pl-isolationType" class="f-select">
        ${sel('pl-isolationType', PART_ISOLATION, ex?.isolationType||'N/A')}
      </select>
    </div>

    <div class="section-label">Physical</div>
    <div class="fg">
      <label class="fg-label">Terminal Count</label>
      <input id="pl-terminalCount" class="f-input" type="number" min="0" value="${ex?.terminalCount||0}">
    </div>
    <div class="fg">
      <label class="fg-label">RTB Type</label>
      <input id="pl-rtbType" class="f-input" type="text" placeholder="e.g. 1756-TBCH" value="${esc(ex?.rtbType||'')}">
    </div>
    <div class="fg" style="flex-direction:row;align-items:center;gap:10px;padding:4px 0">
      <input id="pl-slotInstalled" type="checkbox" style="width:auto;margin:0;flex-shrink:0" ${ex==null||ex?.slotInstalled!==false?'checked':''}>
      <label for="pl-slotInstalled" class="fg-label" style="margin:0">Slot Installed (uncheck for accessories like FPD, ARM, ECR)</label>
    </div>
    <div class="fg">
      <label class="fg-label">Slot Width</label>
      <input id="pl-slotWidth" class="f-input" type="number" min="1" value="${ex?.slotWidth||1}">
    </div>

    <div class="section-label">Backplane Power</div>
    <div class="fg">
      <label class="fg-label">5V Backplane Current (mA)</label>
      <input id="pl-backplaneCurrent5V" class="f-input" type="number" min="0" value="${ex?.backplaneCurrent5V||0}">
    </div>
    <div class="fg">
      <label class="fg-label">24V Backplane Current (mA)</label>
      <input id="pl-backplaneCurrent24V" class="f-input" type="number" min="0" value="${ex?.backplaneCurrent24V||0}">
    </div>

    <div class="section-label">References</div>
    <div class="fg">
      <label class="fg-label">Firmware Revision</label>
      <input id="pl-firmwareRevision" class="f-input" type="text" placeholder="e.g. 20.14" value="${esc(ex?.firmwareRevision||'')}">
    </div>
    <div class="fg">
      <label class="fg-label">User Manual URL</label>
      <input id="pl-userManualUrl" class="f-input" type="url" placeholder="https://..." value="${esc(ex?.userManualUrl||'')}">
    </div>
    <div class="fg">
      <label class="fg-label">Install Guide URL</label>
      <input id="pl-installGuideUrl" class="f-input" type="url" placeholder="https://..." value="${esc(ex?.installGuideUrl||'')}">
    </div>
    <div class="fg">
      <label class="fg-label">Notes</label>
      <textarea id="pl-notes" class="f-textarea" rows="3" placeholder="Additional notes…">${esc(ex?.notes||'')}</textarea>
    </div>
  `;
}

async function savePartsLibForm() {
  const cat  = $('pl-catalogNumber')?.value?.trim();
  const mfr  = $('pl-manufacturer')?.value?.trim();
  const cType = $('pl-cardType')?.value;

  if (!cat || !mfr || !cType) {
    showToast('Catalog number, manufacturer, and card type are required', 'error');
    return;
  }

  const id = state.formId;
  const existing = id ? state.cache.partsLibrary.find(p => p.id === id) : null;

  const part = {
    ...(existing || {}),
    id: id || undefined,
    catalogNumber:       cat,
    manufacturer:        mfr,
    platform:            $('pl-platform')?.value          || '',
    description:         $('pl-description')?.value?.trim() || '',
    cardType:            cType,
    ioType:              $('pl-ioType')?.value             || 'N/A',
    ioPointCount:        parseInt($('pl-ioPointCount')?.value)      || 0,
    voltageLevel:        $('pl-voltageLevel')?.value?.trim()  || '',
    signalRange:         $('pl-signalRange')?.value        || '',
    isolationType:       $('pl-isolationType')?.value      || 'N/A',
    terminalCount:       parseInt($('pl-terminalCount')?.value)     || 0,
    terminalDefinitions: existing?.terminalDefinitions     || [],
    rtbType:             $('pl-rtbType')?.value?.trim()    || '',
    slotInstalled:       !!$('pl-slotInstalled')?.checked,
    slotWidth:           parseInt($('pl-slotWidth')?.value)         || 1,
    backplaneCurrent5V:  parseFloat($('pl-backplaneCurrent5V')?.value) || 0,
    backplaneCurrent24V: parseFloat($('pl-backplaneCurrent24V')?.value) || 0,
    firmwareRevision:    $('pl-firmwareRevision')?.value?.trim()  || '',
    userManualUrl:       $('pl-userManualUrl')?.value?.trim()      || '',
    installGuideUrl:     $('pl-installGuideUrl')?.value?.trim()    || '',
    notes:               $('pl-notes')?.value?.trim()              || '',
  };

  el.formSave.disabled    = true;
  el.formSave.textContent = 'Saving…';

  await upsert('partsLibrary', part);
  await getPartsLibraryCache();
  closeSheet();
  showToast(id ? 'Part updated' : 'Part added', 'success');
  renderPartsLibraryPage();
}

async function deletePartLibEntry(id, catalogNumber) {
  const ok = await confirm('Delete Part', `Remove "${catalogNumber}" from the library?`);
  if (!ok) return;
  await remove('partsLibrary', id);
  await getPartsLibraryCache();
  showToast('Part removed', 'success');
  renderPartsLibraryPage();
}

/* ---- EXPORT ---- */

function exportPartsLibraryXlsx() {
  const parts = state.cache.partsLibrary;
  if (!parts.length) { showToast('No parts to export', ''); return; }

  const rows = parts.map(p => ({
    'Catalog Number':      p.catalogNumber,
    'Manufacturer':        p.manufacturer,
    'Platform':            p.platform,
    'Description':         p.description,
    'Card Type':           p.cardType,
    'IO Type':             p.ioType,
    'IO Points':           p.ioPointCount,
    'Voltage Level':       p.voltageLevel,
    'Signal Range':        p.signalRange,
    'Isolation Type':      p.isolationType,
    'Terminal Count':      p.terminalCount,
    'RTB Type':            p.rtbType,
    'Slot Installed':      p.slotInstalled ? 'Yes' : 'No',
    'Slot Width':          p.slotWidth,
    'Backplane 5V (mA)':  p.backplaneCurrent5V,
    'Backplane 24V (mA)': p.backplaneCurrent24V,
    'Firmware Revision':   p.firmwareRevision,
    'User Manual URL':     p.userManualUrl,
    'Install Guide URL':   p.installGuideUrl,
    'Notes':               p.notes,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Parts Library');
  XLSX.writeFile(wb, 'parts-library.xlsx');
  showToast('Parts library exported', 'success');
}

/* ---- IMPORT ---- */

async function importPartsLibraryXlsx(file) {
  try {
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    let added = 0, updated = 0, skipped = 0;
    const existing = await getAll('partsLibrary');
    const byCat = Object.fromEntries(existing.map(p => [p.catalogNumber?.toLowerCase(), p]));

    for (const row of rows) {
      const cat = (row['Catalog Number'] || '').toString().trim();
      if (!cat) { skipped++; continue; }

      const match = byCat[cat.toLowerCase()];
      const toSlotInstalled = row['Slot Installed'] != null
        ? row['Slot Installed'].toString().toLowerCase() !== 'no'
        : (match?.slotInstalled ?? true);

      const part = {
        ...(match || {}),
        id:                  match?.id || undefined,
        catalogNumber:       cat,
        manufacturer:        (row['Manufacturer']        || match?.manufacturer        || 'Rockwell Automation'),
        platform:            (row['Platform']            || match?.platform            || ''),
        description:         (row['Description']         || match?.description         || ''),
        cardType:            (row['Card Type']           || match?.cardType            || 'Digital'),
        ioType:              (row['IO Type']             || match?.ioType              || 'N/A'),
        ioPointCount:        parseInt(row['IO Points'])         || match?.ioPointCount        || 0,
        voltageLevel:        row['Voltage Level']        ?? match?.voltageLevel        ?? '',
        signalRange:         row['Signal Range']         ?? match?.signalRange         ?? '',
        isolationType:       (row['Isolation Type']      || match?.isolationType       || 'N/A'),
        terminalCount:       parseInt(row['Terminal Count'])    || match?.terminalCount        || 0,
        terminalDefinitions: match?.terminalDefinitions  || [],
        rtbType:             row['RTB Type']             ?? match?.rtbType             ?? '',
        slotInstalled:       toSlotInstalled,
        slotWidth:           parseInt(row['Slot Width'])        || match?.slotWidth            || 1,
        backplaneCurrent5V:  parseFloat(row['Backplane 5V (mA)'])  || match?.backplaneCurrent5V  || 0,
        backplaneCurrent24V: parseFloat(row['Backplane 24V (mA)']) || match?.backplaneCurrent24V || 0,
        firmwareRevision:    row['Firmware Revision']    ?? match?.firmwareRevision    ?? '',
        userManualUrl:       row['User Manual URL']      ?? match?.userManualUrl       ?? '',
        installGuideUrl:     row['Install Guide URL']    ?? match?.installGuideUrl     ?? '',
        notes:               row['Notes']                ?? match?.notes               ?? '',
      };

      await upsert('partsLibrary', part);
      if (match) updated++; else added++;
    }

    await getPartsLibraryCache();
    showToast(`Import complete: ${added} added, ${updated} updated, ${skipped} skipped`, 'success');
    renderPartsLibraryPage();
  } catch (err) {
    console.error('Parts import error:', err);
    showToast('Import failed — check file format', 'error');
  }
}
