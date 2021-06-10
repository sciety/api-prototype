import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.RiotException;
import org.apache.jena.util.FileUtils;
import org.topbraid.jenax.util.JenaUtil;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

final class ModelCollector {
    static Map<File, Model> collect(File file) {
        Map<File, Model> models = new HashMap<>();

        if (file.isFile()) {
            models.put(file, modelFromFile(file));

            return models;
        }

        for (File subFile : Objects.requireNonNull(file.listFiles())) {
            models.putAll(collect(subFile));
        }

        return models;
    }

    private static Model modelFromFile(File file) {
        Model model = JenaUtil.createDefaultModel();

        try {
            InputStream testFile = new FileInputStream(file);
            model.read(testFile, file.getAbsolutePath(), FileUtils.langTurtle);
        } catch (FileNotFoundException | RiotException exception) {
            // Do nothing
        }

        return model;
    }
}
