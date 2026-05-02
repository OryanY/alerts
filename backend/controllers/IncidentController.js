// controllers/IncidentController.js
// ---------------------------------------------------------------
// Handles only HTTP request/response – all business logic lives
// in the services that are injected via the constructor.
// ---------------------------------------------------------------
const { getErrorHtml } = require('./htmlTemplates');

class IncidentController {
  constructor(incidentService, mappingService, ruleService) {
    // -----------------------------------------------------------
    // Dependencies
    // -----------------------------------------------------------
    this.incidentService = incidentService;
    this.mappingService  = mappingService;
    this.ruleService     = ruleService;

    // -----------------------------------------------------------
    // Bind every handler so Express can call it directly
    // -----------------------------------------------------------
    this.getAssignmentGroups         = this.getAssignmentGroups.bind(this);
    this.getNetworks                 = this.getNetworks.bind(this);
    this.getServiceOfferings         = this.getServiceOfferings.bind(this);
    this.getBusinessServices         = this.getBusinessServices.bind(this);
    this.createIncidentFromAlertGET  = this.createIncidentFromAlertGET.bind(this);
    this.createIncidentFromAlertPOST = this.createIncidentFromAlertPOST.bind(this);
    this.createIncidentWithAlertGET  = this.createIncidentWithAlertGET.bind(this);
    this.createIncidentWithAlertPOST = this.createIncidentWithAlertPOST.bind(this);
    this.simulateIncidentCreation    = this.simulateIncidentCreation.bind(this);
    this.getSystemMappings           = this.getSystemMappings.bind(this);
    this.createSystemMapping         = this.createSystemMapping.bind(this);
    this.updateSystemMapping         = this.updateSystemMapping.bind(this);
    this.deleteSystemMapping         = this.deleteSystemMapping.bind(this);
    this.getIncidentRules            = this.getIncidentRules.bind(this);
    this.createIncidentRule          = this.createIncidentRule.bind(this);
    this.updateIncidentRule          = this.updateIncidentRule.bind(this);
    this.deleteIncidentRule          = this.deleteIncidentRule.bind(this);
    this.toggleIncidentRule          = this.toggleIncidentRule.bind(this);
    this.getIncidentLogs             = this.getIncidentLogs.bind(this);
    this.createServiceNowAlert       = this.createServiceNowAlert.bind(this);
    this.createIncidentFromGrafana = this.createIncidentFromGrafana.bind(this);
  }

  // -----------------------------------------------------------------
  // Helper – builds a link that lets the UI jump to the mapping screen
  // -----------------------------------------------------------------
  _getErrorAction(error) {
    if (error.message.includes('No system mapping')) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return {
        label: '➕ יצירת מיפוי חדש',
        url: `${frontendUrl}/incident`
      };
    }
    return null;
  }

  // ====================== ASSIGNMENT GROUPS ======================
  async getAssignmentGroups(req, res, next) {
    try {
      const groups = await this.incidentService.getAssignmentGroups();
      if (!Array.isArray(groups)) {
        console.error('❌ Groups is not an array:', typeof groups);
        return res.status(500).json({ success: false, error: 'Invalid groups data' });
      }
      res.json({ success: true, data: groups, count: groups.length });
    } catch (err) {
      next(err);
    }
  }

  // ====================== OTHER REFERENCE DATA ======================
  async getNetworks(req, res, next) {
    try {
      const networks = await this.incidentService.getNetworks();
      res.json({ success: true, data: networks, count: networks.length });
    } catch (err) {
      console.error('❌ Error fetching networks:', err);
      next(err);
    }
  }

  async getServiceOfferings(req, res, next) {
    try {
      const { parent_service } = req.query;
      const offerings = await this.incidentService.getServiceOfferings(parent_service);
      res.json({ success: true, data: offerings, count: offerings.length });
    } catch (err) {
      console.error('❌ Error fetching service offerings:', err);
      next(err);
    }
  }

  async getBusinessServices(req, res, next) {
    try {
      const { network } = req.query;
      const services = await this.incidentService.getBusinessServices(network);
      res.json({ success: true, data: services, count: services.length });
    } catch (err) {
      console.error('❌ Error fetching business services:', err);
      next(err);
    }
  }

  // ====================== SERVICE‑NOW ALERT ONLY ======================
  async createServiceNowAlert(req, res, next) {
    try {
      const alertData = req.validatedQuery || req.validatedBody; // works for GET & POST
      console.log('Creating ServiceNow alert (%s):', req.method, alertData);
      const result = await this.incidentService.createServiceNowAlert(alertData);

      if (result?.serviceNowResult?.link) {
        return res.redirect(result.serviceNowResult.link);
      }
      return res.json({
        success: true,
        message: 'ServiceNow alert created successfully',
        data: result
      });
    } catch (err) {
      console.error('❌ Error %s /alert: %s', req.method, err.message);
      const isMapping = err.message.includes('No system mapping');
      const status    = isMapping ? 404 : 500;
      const userMsg   = isMapping
        ? 'לא נמצא מיפוי מערכת עבור האפליקציה'
        : 'אירעה שגיאה ביצירת ההתראה';
      const action   = this._getErrorAction(err);
      return res.status(status).send(getErrorHtml(userMsg, err.message, action));
    }
  }

  // ====================== INCIDENT ONLY ======================
  async createIncidentFromAlertGET(req, res, next) {
    try {
      const alertData = req.validatedQuery;
      console.log('Creating incident only (GET):', alertData);
      const result = await this.incidentService.createIncidentFromAlert(alertData);

      if (result?.serviceNowResult?.link) {
        return res.redirect(result.serviceNowResult.link);
      }
      return res.json({
        success: true,
        message: 'Incident created successfully',
        data: result
      });
    } catch (err) {
      console.error('❌ Error GET /incident: %s', err.message);
      const isMapping = err.message.includes('No system mapping');
      const status    = isMapping ? 404 : 500;
      const userMsg   = isMapping
        ? 'לא נמצא מיפוי מערכת עבור האפליקציה'
        : 'אירעה שגיאה פנימית במערכת';
      const action   = this._getErrorAction(err);
      res.status(status).send(getErrorHtml(userMsg, err.message, action));
    }
  }

  async createIncidentFromAlertPOST(req, res, next) {
    try {
      const alertData = req.validatedBody;
      console.log('Creating incident only (POST):', alertData);
      const result = await this.incidentService.createIncidentFromAlert(alertData);
      res.json({
        success: true,
        message: 'Incident created successfully',
        data: result
      });
    } catch (err) {
      if (err.message.includes('No system mapping') || err.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'No system mapping or rules found',
          details: err.message
        });
      }
      next(err);
    }
  }

  async createIncidentFromGrafana(req, res, next) {
    try {
      const { object_name, application, node_name, message, time_created, operator } = req.query;
  
      // Validate required fields
      if (!object_name || !application || !node_name || !message || !time_created || !operator) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
      }
  
      // --- START: Logic migrated from Python from_grafana.py ---
      
      let cleanMessage = message;
      let cleanApplication = application;
  
      // Python: if "%" in data['message']: data['message'] = data['message'].replace('%', ' percent ')
      if (cleanMessage.includes('%')) {
        cleanMessage = cleanMessage.replace(/%/g, ' percent ');
      }
  
      // Python: if data["application"] == 'vmwere' and "esx" in data["message"].lower()
      // Note: object_name is checked for 'esx' in Python
      if (cleanApplication === 'vmwere' && (object_name.toLowerCase().includes('esx') || cleanMessage.toLowerCase().includes('esx'))) {
        cleanApplication = 'virtu_cyber';
      }
  
      // Python: if data["application"] == 'l-twix' -> 'twix'
      if (cleanApplication === 'l-twix') {
        cleanApplication = 'twix';
      }
  
      // --- END: Logic migrated from Python ---
  
      // Construct the alert data object expected by the Node service
      const alertData = {
        object_name: object_name.toLowerCase(),
        application: cleanApplication,
        node_name: node_name,
        message: cleanMessage,
        time_created: time_created,
        operator: operator
      };
  
      console.log('📥 Received Grafana Alert (Legacy Route):', alertData);
  
      // Use the existing service method to create the incident in ServiceNow
      const result = await this.incidentService.createIncidentFromAlert(alertData);
  
      // If the service returns a link, redirect the user to ServiceNow
      if (result?.serviceNowResult?.link) {
        return res.redirect(result.serviceNowResult.link);
      }
  
      return res.json({
        success: true,
        message: 'Incident created successfully via Grafana Route',
        data: result
      });
  
    } catch (err) {
      console.error('❌ Error in /from-grafana:', err.message);
      
      const isMapping = err.message.includes('No system mapping');
      const status = isMapping ? 404 : 500;
      const userMsg = isMapping
        ? 'לא נמצא מיפוי מערכת עבור האפליקציה'
        : 'אירעה שגיאה ביצירת התקלה';
      
      res.status(status).send(getErrorHtml(userMsg, err.message));
    }
  }

  // ====================== INCIDENT + ALERT (COMBINED) ======================
  /** GET /incident‑with‑alert – webhook compatible */
  async createIncidentWithAlertGET(req, res, next) {
    try {
      const params = req.validatedQuery;

      const createAlert   = params.create_servicenow_alert === 'true' || params.create_servicenow_alert === '1';
      const linkToIncident = params.link_to_incident === 'true' || params.link_to_incident === '1';

      const alertData = {
        application:  params.application,
        object_name:  params.object_name,
        node_name:    params.node_name,
        message:      params.message,
        time_created: params.time_created,
        operator:     params.operator,
        network:      params.network,
        user:         params.user
      };

      console.log('GET /incident-with-alert →', { alertData, createAlert, linkToIncident });

      const result = await this.incidentService.createIncidentWithAlert(
        alertData,
        createAlert,
        linkToIncident
      );

      // Prefer the incident link, otherwise the alert link
      const redirectLink = result.incident?.serviceNowResult?.link ||
                           result.alert?.serviceNowResult?.link;

      if (redirectLink) return res.redirect(redirectLink);

      res.json({
        success: true,
        message: 'Incident and alert created successfully',
        data: result
      });
    } catch (err) {
      console.error('❌ Error GET /incident-with-alert: %s', err.message);
      const isMapping = err.message.includes('No system mapping');
      const status    = isMapping ? 404 : 500;
      const userMsg   = isMapping
        ? 'לא נמצא מיפוי מערכת עבור האפליקציה'
        : 'אירעה שגיאה ביצירת התקלה וההתראה';
      const action    = this._getErrorAction(err);
      res.status(status).send(getErrorHtml(userMsg, err.message, action));
    }
  }

  /** POST /incident‑with‑alert – programmatic use */
  async createIncidentWithAlertPOST(req, res, next) {
    try {
      const {
        alert,
        create_servicenow_alert = true,
        link_to_incident = true
      } = req.body;

      if (!alert) {
        return res.status(400).json({
          success: false,
          error: 'Missing alert data',
          details: 'Request body must include an "alert" object'
        });
      }

      console.log('POST /incident-with-alert →', { alert, create_servicenow_alert, link_to_incident });

      const result = await this.incidentService.createIncidentWithAlert(
        alert,
        create_servicenow_alert,
        link_to_incident
      );

      res.json({
        success: true,
        message: 'Incident and alert created successfully',
        data: result
      });
    } catch (err) {
      // Re‑use generic error handling
      const isMapping = err.message.includes('No system mapping');
      const status    = isMapping ? 404 : 500;
      const userMsg   = isMapping
        ? 'לא נמצא מיפוי מערכת עבור האפליקציה'
        : 'אירעה שגיאה ביצירת התקלה וההתראה';
      const action    = this._getErrorAction(err);
      res.status(status).send(getErrorHtml(userMsg, err.message, action));
    }
  }

  // ====================== SIMULATION ======================
  async simulateIncidentCreation(req, res, next) {
    try {
      const alertData = req.validatedBody;
      console.log('🧪 Simulating incident creation:', alertData);
      const simulationResult = await this.incidentService.simulateIncidentCreation(alertData);
      res.json({
        success: true,
        message: 'Simulation completed',
        data: simulationResult
      });
    } catch (err) {
      next(err);
    }
  }

  // ====================== SYSTEM MAPPINGS ======================
  async getSystemMappings(req, res, next) {
    try {
      const mappings = await this.mappingService.getSystemMappings();
      res.json({ success: true, data: mappings, count: mappings.length });
    } catch (err) {
      next(err);
    }
  }

  async createSystemMapping(req, res, next) {
    try {
      const mappingData = req.validatedBody;
      const newMapping  = await this.mappingService.createSystemMapping(mappingData);
      res.status(201).json({
        success: true,
        message: 'System mapping created successfully',
        data: newMapping
      });
    } catch (err) {
      if (err.message.includes('already exist')) {
        return res.status(409).json({
          success: false,
          error: 'Mapping already exists',
          details: err.message
        });
      }
      next(err);
    }
  }

  async updateSystemMapping(req, res, next) {
    try {
      const { id } = req.params;
      const mappingData = req.validatedBody;
      const updated = await this.mappingService.updateSystemMapping(id, mappingData);
      res.json({
        success: true,
        message: 'System mapping updated successfully',
        data: updated
      });
    } catch (err) {
      if (err.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'System mapping not found',
          details: err.message
        });
      }
      next(err);
    }
  }

  async deleteSystemMapping(req, res, next) {
    try {
      const { id } = req.params;
      const result = await this.mappingService.deleteSystemMapping(id);
      res.json({ success: true, message: result.message, deletedCount: result.deletedCount });
    } catch (err) {
      if (err.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'System mapping not found',
          details: err.message
        });
      }
      next(err);
    }
  }

  // ====================== INCIDENT RULES ======================
  async getIncidentRules(req, res, next) {
    try {
      const { application } = req.query;
      const rules = await this.ruleService.getIncidentRules(application);
      res.json({ success: true, data: rules, count: rules.length });
    } catch (err) {
      next(err);
    }
  }

  async createIncidentRule(req, res, next) {
    try {
      const ruleData = req.validatedBody;
      const newRule  = await this.ruleService.createIncidentRule(ruleData);
      res.status(201).json({
        success: true,
        message: 'Incident rule created successfully',
        data: newRule
      });
    } catch (err) {
      if (err.message.includes('System mapping not found')) {
        return res.status(404).json({
          success: false,
          error: 'System mapping not found',
          details: err.message
        });
      }
      next(err);
    }
  }

  async updateIncidentRule(req, res, next) {
    try {
      const { id } = req.params;
      const ruleData = req.validatedBody;
      const updated = await this.ruleService.updateIncidentRule(id, ruleData);
      res.json({
        success: true,
        message: 'Incident rule updated successfully',
        data: updated
      });
    } catch (err) {
      if (err.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Rule not found',
          details: err.message
        });
      }
      next(err);
    }
  }

  async deleteIncidentRule(req, res, next) {
    try {
      const { id } = req.params;
      const result = await this.ruleService.deleteIncidentRule(id);
      res.json({ success: true, message: result.message, deletedCount: result.deletedCount });
    } catch (err) {
      if (err.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Incident rule not found',
          details: err.message
        });
      }
      next(err);
    }
  }

  async toggleIncidentRule(req, res, next) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: 'enabled field must be a boolean'
        });
      }
      const result = await this.ruleService.toggleIncidentRule(id, enabled);
      res.json({ success: true, message: result.message });
    } catch (err) {
      if (err.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Incident rule not found',
          details: err.message
        });
      }
      next(err);
    }
  }

  // ====================== HISTORY / LOGS ======================
  async getIncidentLogs(req, res, next) {
    try {
      const { limit = 50, skip = 0, search = '' } = req.query;
      const result = await this.incidentService.getIncidentHistory(
        parseInt(limit, 10),
        parseInt(skip, 10),
        search
      );
      res.json({
        success: true,
        data: result.logs,
        count: result.total,
        meta: { limit, skip, search }
      });
    } catch (err) {
      next(err);
    }
  }

  // ====================== UTILITY ======================
}

module.exports = { IncidentController };
