import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.topbraid.jenax.util.JenaUtil;
import org.topbraid.shacl.testcases.TestCase;
import org.topbraid.shacl.testcases.TestCaseType;
import org.topbraid.shacl.testcases.TestCaseTypes;
import org.topbraid.shacl.util.SHACLSystemModel;
import picocli.CommandLine;
import picocli.CommandLine.Help.Ansi;

import java.io.File;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;

@CommandLine.Command(name = "test-shacl")
final class TestShacl implements Callable<Integer> {
    @CommandLine.Parameters(index = "0", description = "Test case file or directory")
    private File tests;

    @CommandLine.Parameters(index = "1", description = "Shapes file or directory")
    private File shapes;

    public static void main(String... args) {
        int exitCode = new CommandLine(new TestShacl()).execute(args);
        System.exit(exitCode);
    }

    public Integer call() {
        Model shapesModel = collectShapesModel(this.shapes);
        Map<File, Model> testModels = ModelCollector.collect(this.tests);
        Map<File, Collection<TestCase>> testCases = createTestCases(testModels, shapesModel);

        List<TestResult> results = new ArrayList<>();

        for (Map.Entry<File, Collection<TestCase>> test : testCases.entrySet()) {
            File file = test.getKey();

            for (TestCase testCase : test.getValue()) {
                results.add(TestRunner.runTest(testCase, file));
            }
        }

        for (TestResult testResult : results) {
            File file = testResult.getFile();

            if (testResult instanceof TestPass) {
                System.out.println(Ansi.AUTO.string("@|green  ✔︎ " + file.getPath() + "|@"));
            } else {
                System.out.println(Ansi.AUTO.string("@|red  ✘ " + file.getPath() + "|@"));
            }
        }

        if (results.size() == 0) {
            System.out.println(Ansi.AUTO.string("@|red No tests found|@"));

            return 1;
        }

        List<TestFail> failures = results.stream()
                .filter(TestFail.class::isInstance)
                .map(TestFail.class::cast)
                .collect(Collectors.toList());

        int numberOfFails = failures.size();
        int numberOfPasses = results.size() - numberOfFails;

        if (failures.size() > 0) {
            System.out.println();
            System.out.println();
            System.out.println(Ansi.AUTO.string("@|red     " + failures.size() + " test failure" + (failures.size() > 1 ? "s" : "") + "|@"));
            System.out.println();
            for (TestFail failure : failures) {
                System.out.println();
                System.out.println(Ansi.AUTO.string("@|red  ● " + failure.getFile().getPath() + "|@"));
                System.out.println(Ansi.AUTO.string("@|red    " + failure.getMessage() + "|@"));

                List<String> diff = ModelDiffer.diff(failure.getExpected(), failure.getActual());
                for (String detail : diff) {
                    System.out.println(Ansi.AUTO.string("      " + detail));
                }
            }
            System.out.println();
        }

        System.out.println();
        if (numberOfPasses > 0) {
            System.out.print(Ansi.AUTO.string("@|green  " + numberOfPasses + " passed|@"));
        }
        if (numberOfFails > 0) {
            System.out.print(Ansi.AUTO.string("@|red  " + numberOfFails + " failed|@"));
        }

        System.out.print("\n");

        return failures.size();
    }

    private Model collectShapesModel(File shapes) {
        Model shapesModel = JenaUtil.createDefaultModel();
        shapesModel.add(SHACLSystemModel.getSHACLModel());

        for (Model shape : ModelCollector.collect(shapes).values()) {
            shapesModel.add(shape);
        }

        return shapesModel;
    }

    private Map<File, Collection<TestCase>> createTestCases(Map<File, Model> tests, Model shapesModel) {
        Map<File, Collection<TestCase>> testCases = new HashMap<>();
        Resource ontology = ResourceFactory.createResource("http://example.com/");

        for (Map.Entry<File, Model> test : tests.entrySet()) {
            File file = test.getKey();
            Model model = test.getValue();
            model.add(shapesModel);

            Collection<TestCase> fileTestCases = testCases.getOrDefault(file, new ArrayList<>());

            for (TestCaseType type : TestCaseTypes.getTypes()) {
                fileTestCases.addAll(type.getTestCases(model, ontology));
            }

            testCases.put(file, fileTestCases);
        }

        return testCases;
    }
}
