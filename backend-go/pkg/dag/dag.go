package dag

import "fmt"

// ValidationResult represents DAG topological verification output.
type ValidationResult struct {
	Valid      bool     `json:"valid"`
	TotalNodes int      `json:"total_nodes"`
	TotalEdges int      `json:"total_edges"`
	Acyclic    bool     `json:"acyclic"`
	Order      []string `json:"execution_order,omitempty"`
	Error      string   `json:"error,omitempty"`
}

// ValidateDAG runs Kahn's algorithm to ensure topological acyclicity.
func ValidateDAG(nodes []map[string]interface{}, edges []map[string]string) ValidationResult {
	nodeCount := len(nodes)
	edgeCount := len(edges)

	if nodeCount == 0 {
		return ValidationResult{
			Valid:      false,
			TotalNodes: 0,
			TotalEdges: edgeCount,
			Acyclic:    false,
			Error:      "Workflow must contain at least one step node",
		}
	}

	nodeIDs := make(map[string]bool)
	for _, n := range nodes {
		id, _ := n["id"].(string)
		if id != "" {
			nodeIDs[id] = true
		}
	}

	inDegree := make(map[string]int)
	adjList := make(map[string][]string)

	for id := range nodeIDs {
		inDegree[id] = 0
		adjList[id] = make([]string, 0)
	}

	for _, e := range edges {
		src := e["source"]
		tgt := e["target"]

		if !nodeIDs[src] || !nodeIDs[tgt] {
			return ValidationResult{
				Valid:      false,
				TotalNodes: nodeCount,
				TotalEdges: edgeCount,
				Acyclic:    false,
				Error:      fmt.Sprintf("Edge references non-existent node ('%s' -> '%s')", src, tgt),
			}
		}

		adjList[src] = append(adjList[src], tgt)
		inDegree[tgt]++
	}

	// Queue nodes with in-degree = 0
	var queue []string
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}

	var executionOrder []string
	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]
		executionOrder = append(executionOrder, curr)

		for _, nxt := range adjList[curr] {
			inDegree[nxt]--
			if inDegree[nxt] == 0 {
				queue = append(queue, nxt)
			}
		}
	}

	hasCycle := len(executionOrder) != nodeCount
	if hasCycle {
		return ValidationResult{
			Valid:      false,
			TotalNodes: nodeCount,
			TotalEdges: edgeCount,
			Acyclic:    false,
			Error:      "Cyclic dependency detected: Graph cannot be topologically sorted",
		}
	}

	return ValidationResult{
		Valid:      true,
		TotalNodes: nodeCount,
		TotalEdges: edgeCount,
		Acyclic:    true,
		Order:      executionOrder,
	}
}
