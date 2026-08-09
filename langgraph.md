
1. In standard LangChain, you build linear chains (Prompt | LLM | Parser). In LangGraph, you build cyclic graphs that allow for loops, reasoning, and multi-agent collaboration.
    There are only three core concepts you need to memorize:

    - State (TypedDict or Pydantic): This is the global memory of your graph. It is a dictionary that gets passed from node to node. Every node reads from it, does some work, and returns an update to it.

    - Nodes (The "Doers"): These are standard Python functions. A node receives the current State, runs a LangChain invocation (or any custom Python code), and returns a dictionary that updates the State.

    - Edges (The "Routers"): These connect nodes.

        - Standard Edges: "Always go from Node A to Node B."

        - Conditional Edges: "Look at the State. If the LLM decided to use a tool, go to the Tool Node. If it decided to output an answer, go to the End Node."