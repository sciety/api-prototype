package org.sciety.shacltest;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.Collection;
import java.util.LinkedList;
import java.util.List;
import java.util.Objects;

import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.util.FileUtils;
import org.apache.jena.vocabulary.RDF;
import org.junit.Assert;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.junit.runners.Parameterized.Parameters;
import org.topbraid.jenax.util.JenaUtil;
import org.topbraid.shacl.testcases.TestCase;
import org.topbraid.shacl.testcases.TestCaseType;
import org.topbraid.shacl.testcases.TestCaseTypes;
import org.topbraid.shacl.util.SHACLSystemModel;
import org.topbraid.shacl.vocabulary.DASH;
import org.topbraid.shacl.vocabulary.SH;

@RunWith(Parameterized.class)
final public class TestCases {
    @Parameters(name = "{1}")
    public static Collection<Object[]> data() throws Exception {
        List<TestCase> testCases = new LinkedList<TestCase>();
        File rootFolder = new File("test");
        collectTestCases(rootFolder, testCases);

        List<Object[]> results = new LinkedList<Object[]>();

        for (TestCase testCase : testCases) {
            results.add(new Object[]{testCase, testCase.getResource().toString()});
        }

        return results;
    }

    private static void collectTestCases(File folder, List<TestCase> testCases) throws Exception {
        Model shapesModel = JenaUtil.createDefaultModel();
        InputStream shapesFile = new FileInputStream("schema.ttl");
        shapesModel.read(shapesFile, "http://example.com/", FileUtils.langTurtle);
        shapesModel.add(SHACLSystemModel.getSHACLModel());

        for (File f : Objects.requireNonNull(folder.listFiles())) {
            if (f.isDirectory()) {
                collectTestCases(f, testCases);
            } else if (f.isFile() && f.getName().endsWith(".ttl")) {
                Model testModel = JenaUtil.createDefaultModel();
                InputStream testFile = new FileInputStream(f);
                testModel.read(testFile, f.getAbsolutePath(), FileUtils.langTurtle);
                testModel.add(shapesModel);
                Resource ontology = ResourceFactory.createResource("http://example.com/");
                for (TestCaseType type : TestCaseTypes.getTypes()) {
                    testCases.addAll(type.getTestCases(testModel, ontology));
                }
            }
        }
    }

    private final TestCase testCase;

    public TestCases(TestCase testCase, String name) {
        this.testCase = testCase;
    }

    @Test
    public void testTestCase() {
        Model results = JenaUtil.createMemoryModel();
        try {
            testCase.run(results);
        } catch (Exception ex) {
            testCase.createFailure(results, "Exception during test case execution: " + ex);
            ex.printStackTrace();
        }
        for (Statement s : results.listStatements(null, RDF.type, DASH.FailureTestCaseResult).toList()) {
            String message = JenaUtil.getStringProperty(s.getSubject(), SH.resultMessage);
            if (message == null) {
                message = "(No " + SH.PREFIX + ":" + SH.resultMessage.getLocalName() + " found in failure)";
            }
            Assert.fail(testCase.getResource() + ": " + message);
        }
    }

}
