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
    type: 'RULES_PROCESSED' | 'BATCH_PROCESSED' | 'PROGRESS_UPDATE';
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
    };
}

// Enhanced worker script with progress reporting
export const workerScript = `
self.onmessage = function(e) {
  const { type, payload } = e.data;
  
  if (type === 'PROCESS_RULES') {
    const { elements, rules, modelID } = payload;
    const matches = [];
    const logs = [];
    
    // Process in batches to allow progress updates
    const BATCH_SIZE = 100;
    const totalElements = elements.length;
    const totalBatches = Math.ceil(totalElements / BATCH_SIZE);
    
    let processedElements = 0;
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, totalElements);
      const batchElements = elements.slice(startIdx, endIdx);
      
      // Process this batch
      for (const element of batchElements) {
        for (const rule of rules) {
          // Simple IFC Class matching for now
          const ifcClassConditions = rule.conditions.filter(c => c.property === "Ifc Class");
          
          let elementMatches = true;
          for (const condition of ifcClassConditions) {
            const elementType = element.type.toUpperCase();
            const ruleType = condition.value.toUpperCase();
            
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
              logs.push(\`✓ \${element.type.replace('IFC', 'Ifc')} → \${rule.classificationCode} (#\${element.expressID})\`);
            }
          }
        }
        processedElements++;
      }
      
      // Send progress update
      const progress = Math.round((processedElements / totalElements) * 100);
      self.postMessage({
        type: 'PROGRESS_UPDATE',
        payload: {
          progress,
          status: \`Processing elements \${processedElements}/\${totalElements}...\`,
          logs: logs.slice(-50) // Keep only recent logs
        }
      });
      
      // Yield control back to main thread briefly
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    self.postMessage({
      type: 'RULES_PROCESSED',
      payload: { 
        matches,
        logs: logs.slice(-100)
      }
    });
  }
};
`;
