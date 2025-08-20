// Web Worker for parallel rule processing
import { IfcAPI } from "web-ifc";

export interface WorkerMessage {
  type: 'PROCESS_RULES' | 'PROCESS_BATCH';
  payload: {
    elements: Array<{ expressID: number; type: string }>;
    rules: Array<{
      id: string;
      name: string;
      classificationCode: string;
      conditions: Array<{
        property: string;
        operator: string;
        value: any;
      }>;
      matchType: string;
    }>;
    modelID: number;
    batchIndex?: number;
    totalBatches?: number;
  };
}

export interface WorkerResponse {
  type: 'RULES_PROCESSED' | 'BATCH_PROCESSED' | 'PROGRESS_UPDATE' | 'ERROR';
  payload: {
    matches?: Array<{
      elementID: number;
      classificationCode: string;
    }>;
    progress?: number;
    status?: string;
    batchIndex?: number;
    totalBatches?: number;
    logs?: string[];
    error?: string;
  };
}

// Enhanced worker script with comprehensive error handling and validation
export const workerScript = `
self.onmessage = async function(e) {
  try {
    // Validate message structure
    if (!e.data || typeof e.data !== 'object') {
      throw new Error('Invalid message: missing or invalid data object');
    }

    const { type, payload } = e.data;
    
    if (!type || typeof type !== 'string') {
      throw new Error('Invalid message: missing or invalid message type');
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('Missing payload in worker message');
    }
    
    if (type === 'PROCESS_RULES') {
      // Validate PROCESS_RULES payload
      const { elements = [], rules = [], modelID } = payload;
      
      if (!modelID || typeof modelID !== 'number') {
        throw new Error('Missing or invalid modelID in PROCESS_RULES payload');
      }
      
      if (!Array.isArray(elements)) {
        throw new Error('Invalid elements array in PROCESS_RULES payload');
      }
      
      if (!Array.isArray(rules)) {
        throw new Error('Invalid rules array in PROCESS_RULES payload');
      }

      const matches = [];
      const logs = [];
      
      // Handle empty elements gracefully
      if (elements.length === 0) {
        logs.push('No elements to process');
        self.postMessage({
          type: 'RULES_PROCESSED',
          payload: { 
            matches: [],
            logs: ['No elements to process']
          }
        });
        return;
      }

      // Handle empty rules gracefully
      if (rules.length === 0) {
        logs.push('No rules to apply');
        self.postMessage({
          type: 'RULES_PROCESSED',
          payload: { 
            matches: [],
            logs: ['No rules to apply']
          }
        });
        return;
      }
      
      // Process in batches to allow progress updates
      const BATCH_SIZE = Math.max(1, Math.min(100, Math.ceil(elements.length / 10))); // Adaptive batch size
      const totalElements = elements.length;
      const totalBatches = Math.ceil(totalElements / BATCH_SIZE);
      
      let processedElements = 0;
      
      logs.push('Starting rule processing: ' + totalElements + ' elements, ' + rules.length + ' rules, ' + totalBatches + ' batches');
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, totalElements);
      const batchElements = elements.slice(startIdx, endIdx);
      
      // Process this batch
      for (const element of batchElements) {
        // Validate element structure
        if (!element || typeof element !== 'object' || !element.type || typeof element.expressID !== 'number') {
          logs.push('Skipping invalid element: ' + JSON.stringify(element));
          processedElements++;
          continue;
        }

        for (const rule of rules) {
          // Validate rule structure
          if (!rule || typeof rule !== 'object' || !rule.conditions || !Array.isArray(rule.conditions) || !rule.classificationCode) {
            continue;
          }

          try {
            // Simple IFC Class matching for now
            const ifcClassConditions = rule.conditions.filter(c => 
              c && typeof c === 'object' && c.property === "Ifc Class"
            );
            
            let elementMatches = true;
            for (const condition of ifcClassConditions) {
              if (!condition.value || !condition.operator) {
                continue;
              }

              const elementType = String(element.type).toUpperCase();
              const ruleType = String(condition.value).toUpperCase();
              
              if (condition.operator === "equals" && elementType !== ruleType) {
                elementMatches = false;
                break;
              } else if (condition.operator === "contains" && !elementType.includes(ruleType)) {
                elementMatches = false;
                break;
              }
            }
            
            if (elementMatches && ifcClassConditions.length > 0) {
              matches.push({
                elementID: element.expressID,
                classificationCode: rule.classificationCode
              });
              
              // Add log entry for significant matches (throttled)
              if (element.expressID % 50 === 0) {
                logs.push('✓ ' + element.type.replace('IFC', 'Ifc') + ' → ' + rule.classificationCode + ' (#' + element.expressID + ')');
              }
            }
          } catch (ruleError) {
            const errorMsg = ruleError instanceof Error ? ruleError.message : String(ruleError);
            logs.push('Error processing rule ' + (rule.id || 'unknown') + ': ' + errorMsg);
          }
        }
        processedElements++;
      }
      
      // Send progress update
      const progress = totalElements > 0 ? Math.round((processedElements / totalElements) * 100) : 100;
      self.postMessage({
        type: 'PROGRESS_UPDATE',
        payload: {
          progress,
          status: 'Processing elements ' + processedElements + '/' + totalElements + '...',
          logs: logs.slice(-50) // Keep only recent logs
        }
      });
      
      // Yield control back to main thread briefly
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    logs.push('Processing complete: ' + matches.length + ' matches found from ' + processedElements + ' elements');
    
    self.postMessage({
      type: 'RULES_PROCESSED',
      payload: { 
        matches,
        logs: logs.slice(-100)
      }
    });
    
  } else if (type === 'PROCESS_BATCH') {
    // Handle batch processing message
    const { batchIndex = 0, totalBatches = 1, elements = [], rules = [], modelID } = payload;
    
    if (!modelID || typeof modelID !== 'number') {
      throw new Error('Missing or invalid modelID in PROCESS_BATCH payload');
    }
    
    const matches = [];
    const logs = ['Processing batch ' + (batchIndex + 1) + '/' + totalBatches];
    
    // Simple batch processing
    for (const element of elements) {
      if (!element || typeof element !== 'object' || !element.type || typeof element.expressID !== 'number') {
        continue;
      }

      for (const rule of rules) {
        if (!rule || typeof rule !== 'object' || !rule.conditions || !Array.isArray(rule.conditions)) {
          continue;
        }

        try {
          const ifcClassConditions = rule.conditions.filter(c => 
            c && typeof c === 'object' && c.property === "Ifc Class"
          );
          
          let elementMatches = true;
          for (const condition of ifcClassConditions) {
            if (!condition.value || !condition.operator) continue;

            const elementType = String(element.type).toUpperCase();
            const ruleType = String(condition.value).toUpperCase();
            
            if (condition.operator === "equals" && elementType !== ruleType) {
              elementMatches = false;
              break;
            } else if (condition.operator === "contains" && !elementType.includes(ruleType)) {
              elementMatches = false;
              break;
            }
          }
          
          if (elementMatches && ifcClassConditions.length > 0) {
            matches.push({
              elementID: element.expressID,
              classificationCode: rule.classificationCode
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logs.push('Error in batch processing: ' + errorMsg);
        }
      }
    }
    
    self.postMessage({
      type: 'BATCH_PROCESSED',
      payload: {
        batchIndex,
        totalBatches,
        matches,
        logs
      }
    });
    
  } else {
    throw new Error('Unknown message type: ' + type);
  }
  
  } catch (error) {
    // Comprehensive error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    self.postMessage({
      type: 'ERROR',
      payload: {
        error: errorMessage,
        logs: ['Worker Error: ' + errorMessage]
      }
    });
  }
};
`;