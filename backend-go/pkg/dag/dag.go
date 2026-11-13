package dag

import (
	"fmt"
	"sort"

	"github.com/enterprise/ai-agent-studio-backend-go/pkg/models"
)

// ValidationResult represents DAG topological verification output matching WorkflowStudioView expectations.
type ValidationResult struct {
	IsValid         bool       `json:"is_valid"`
	Valid           bool       `json:"valid"`
	TotalNodes      int        `json:"total_nodes"`
	TotalEdges      int        `json:"total_edges"`
	Acyclic         bool       `json:"acyclic"`
	Order           []string   `json:"execution_order,omitempty"`
	ExecutionLayers [][]string `json:"execution_layers,omitempty"`
	Errors          []string   `json:"errors,omitempty"`
	Error           string     `json:"error,omitempty"`
}

// ValidateWorkflowDAG validates strongly typed workflow nodes and edges using layered Kahn's topological sort.
func ValidateWorkflowDAG(nodes []models.WorkflowNode, edges []models.WorkflowEdge) ValidationResult {
	nodeMaps := make([]map[string]interface{}, len(nodes))
	for i, n := range nodes {
		nodeMaps[i] = map[string]interface{}{"id": n.ID, "name": n.Name, "type": n.Type}
	}
	edgeMaps := make([]map[string]string, len(edges))
	for i, e := range edges {
		edgeMaps[i] = map[string]string{"source": e.Source, "target": e.Target}
	}
	return ValidateDAG(nodeMaps, edgeMaps)
}

// ValidateDAG runs Kahn's algorithm with BFS topological layering to guarantee acyclicity and parallel layers.
func ValidateDAG(nodes []map[string]interface{}, edges []map[string]string) ValidationResult {
	nodeCount := len(nodes)
	edgeCount := len(edges)

	if nodeCount == 0 {
		msg := "Workflow must contain at least one step node"
		return ValidationResult{
			IsValid:    false,
			Valid:      false,
			TotalNodes: 0,
			TotalEdges: edgeCount,
			Acyclic:    false,
			Errors:     []string{msg},
			Error:      msg,
		}
	}

	nodeIDs := make(map[string]bool)
	orderedIDs := make([]string, 0, nodeCount)
	for _, n := range nodes {
		id, _ := n["id"].(string)
		if id != "" && !nodeIDs[id] {
			nodeIDs[id] = true
			orderedIDs = append(orderedIDs, id)
		}
	}

	inDegree := make(map[string]int, len(nodeIDs))
	adjList := make(map[string][]string, len(nodeIDs))
	for _, id := range orderedIDs {
		inDegree[id] = 0
		adjList[id] = make([]string, 0)
	}

	for _, e := range edges {
		src := e["source"]
		tgt := e["target"]

		if !nodeIDs[src] || !nodeIDs[tgt] {
			msg := fmt.Sprintf("Edge references non-existent node ('%s' -> '%s')", src, tgt)
			return ValidationResult{
				IsValid:    false,
				Valid:      false,
				TotalNodes: nodeCount,
				TotalEdges: edgeCount,
				Acyclic:    false,
				Errors:     []string{msg},
				Error:      msg,
			}
		}

		adjList[src] = append(adjList[src], tgt)
		inDegree[tgt]++
	}

	var queue []string
	for _, id := range orderedIDs {
		if inDegree[id] == 0 {
			queue = append(queue, id)
		}
	}

	var executionOrder []string
	var layers [][]string

	for len(queue) > 0 {
		layerSize := len(queue)
		currentLayer := make([]string, 0, layerSize)
		var nextQueue []string

		for i := 0; i < layerSize; i++ {
			curr := queue[i]
			currentLayer = append(currentLayer, curr)
			executionOrder = append(executionOrder, curr)

			for _, nxt := range adjList[curr] {
				inDegree[nxt]--
				if inDegree[nxt] == 0 {
					nextQueue = append(nextQueue, nxt)
				}
			}
		}
		sort.Strings(nextQueue)
		layers = append(layers, currentLayer)
		queue = nextQueue
	}

	hasCycle := len(executionOrder) != len(nodeIDs)
	if hasCycle {
		msg := "Cyclic dependency detected: Graph cannot be topologically sorted"
		return ValidationResult{
			IsValid:    false,
			Valid:      false,
			TotalNodes: nodeCount,
			TotalEdges: edgeCount,
			Acyclic:    false,
			Errors:     []string{msg},
			Error:      msg,
		}
	}

	return ValidationResult{
		IsValid:         true,
		Valid:           true,
		TotalNodes:      nodeCount,
		TotalEdges:      edgeCount,
		Acyclic:         true,
		Order:           executionOrder,
		ExecutionLayers: layers,
		Errors:          []string{},
	}
}
